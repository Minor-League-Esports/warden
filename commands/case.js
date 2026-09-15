const log4js = require('log4js');
const logger = log4js.getLogger('CaseCommand');
const { logLevel, opsGuild, moderatorRoleId } = require('../config.json');
logger.level = logLevel;

const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { buildModeratorNoteModal } = require('../util/UtilFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('case')
		.setDescription('Create and manage moderation cases')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('create')
				.setDescription('Create a case without an attached report')
				.addStringOption((option) =>
					option.setName('subject').setDescription('The user who is the subject of the case').setRequired(true),
				)
				.addStringOption((option) => option.setName('notes').setDescription('Initial moderator notes')),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('details')
				.setDescription('Show a case and all of its linked records')
				.addIntegerOption((option) =>
					option.setName('case_id').setDescription('The case number').setMinValue(1).setRequired(true),
				),
		)
		.addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all open cases'))
		.addSubcommand((subcommand) =>
			subcommand
				.setName('assign')
				.setDescription('Assign a case to a moderator')
				.addIntegerOption((option) =>
					option.setName('case_id').setDescription('The case number').setMinValue(1).setRequired(true),
				)
				.addStringOption((option) =>
					option
						.setName('moderator')
						.setDescription('Moderator identifier (Discord ID, MLE ID, or username)')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('close')
				.setDescription('Close a case after confirmation')
				.addIntegerOption((option) =>
					option.setName('case_id').setDescription('The case number').setMinValue(1).setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('note')
				.setDescription('Add a moderator note to a case or report')
				.addIntegerOption((option) =>
					option.setName('case_id').setDescription('The case number').setMinValue(1).setRequired(false),
				)
				.addIntegerOption((option) =>
					option.setName('report_id').setDescription('The report number').setMinValue(1).setRequired(false),
				),
		),

	async execute(interaction) {
		if (interaction.guildId !== opsGuild) {
			await interaction.reply({
				content: 'This command must be run from the MLE Staff server.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'note') {
			await openNoteModal(interaction);
			return;
		}

		await interaction.deferReply();

		try {
			if (subcommand === 'create') {
				await createCase(interaction);
			} else if (subcommand === 'list') {
				await listOpenCases(interaction);
			} else if (subcommand === 'details') {
				await showCaseDetails(interaction);
			} else if (subcommand === 'assign') {
				await assignCase(interaction);
			} else if (subcommand === 'close') {
				await requestCaseClose(interaction);
			} else {
				await interaction.editReply({ content: 'Unknown case subcommand.' });
			}
		} catch (error) {
			logger.error(`Error executing case subcommand ${subcommand}:`, error);
			await interaction.editReply({ content: 'Unable to complete that case operation.' });
		}
	},
};

async function createCase(interaction) {
	const creator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
	const subject = await globalThis.userUtility.fetchDatabaseUser(interaction.options.getString('subject'));
	const notes = interaction.options.getString('notes');
	const createdCase = await globalThis.databaseManager.createCase(
		creator.getUserId(),
		subject.getUserId(),
		'OPEN',
		new Date().toISOString(),
		null,
		notes,
	);

	const fullCase = await globalThis.databaseManager.getCaseById(createdCase.getCaseId());
	let caseLink = null;
	if (globalThis.caseChannel) {
		const subjectMention = fullCase.getSubjectUser()?.getDiscordId()
			? `<@${fullCase.getSubjectUser().getDiscordId()}>`
			: fullCase.getSubjectId();
		const message = await globalThis.caseChannel.send({
			content: `Case #${fullCase.getCaseId()} | ${subjectMention}`,
			embeds: [fullCase.generatePrivateEmbed()],
		});
		await message.pin().catch((error) => logger.warn(`Could not pin Case #${fullCase.getCaseId()} message: ${error}`));
		caseLink = message.url;
		const thread = await message.startThread({
			name: `Case #${fullCase.getCaseId()} (${fullCase.getSubjectUser()?.getUserName() ?? 'Unknown'})`,
		});
		await thread.send({
			content: `<@&${moderatorRoleId}> A new case has been opened.`,
			components: [generateCaseActionRow(fullCase.getCaseId())],
		});
		await globalThis.databaseManager.updateCase(fullCase.getCaseId(), { case_link: caseLink });
	}

	await interaction.editReply({
		content: `Created Case #${fullCase.getCaseId()} for ${subject.getUserName()}.${caseLink ? ` ${caseLink}` : ''}`,
	});
}

async function listOpenCases(interaction) {
	const cases = await globalThis.databaseManager.getOpenCases();
	if (cases.length === 0) {
		await interaction.editReply({ content: 'There are no open cases.' });
		return;
	}

	let content = 'Open cases:\n';
	for (const kase of cases) {
		const subject = kase.subject_discord_id ? `<@${kase.subject_discord_id}>` : kase.subject_name;
		const moderator = kase.moderator_name ?? 'Unassigned';
		const created = new Date(kase.created_at).toISOString().slice(0, 10);
		const line = `- [Case #${kase.case_id}](${kase.case_link}) | ${subject} (${kase.subject_name}) | Moderator: ${moderator} | Opened: ${created}\n`;
		if (content.length + line.length > 1990) {
			content += `... and more (${cases.length - cases.indexOf(kase)} additional case(s)).`;
			break;
		}
		content += line;
	}

	await interaction.editReply({ content });
}

async function assignCase(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const moderator = await globalThis.userUtility.fetchDatabaseUser(interaction.options.getString('moderator'));
	const updatedCase = await globalThis.databaseManager.claimCase(caseId, moderator.getUserId());

	await interaction.editReply({
		content: `Assigned Case #${caseId} to ${moderator.getUserName()}. All attached reports were reassigned as well.`,
	});
	return updatedCase;
}

async function requestCaseClose(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const kase = await globalThis.databaseManager.getCaseById(caseId);
	if (String(kase.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Case #${caseId} is already closed.` });
		return;
	}

	await interaction.editReply({
		content: `Are you sure you want to close Case #${caseId}? This will close all open reports attached to it.`,
		components: [generateCloseConfirmationRow(caseId, interaction.user.id)],
	});
}

async function openNoteModal(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const reportId = interaction.options.getInteger('report_id');

	if ((caseId === null) === (reportId === null)) {
		await interaction.reply({
			content: 'Provide exactly one of `case_id` or `report_id`.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const targetType = caseId === null ? 'report' : 'case';
	const targetId = caseId ?? reportId;
	try {
		if (targetType === 'case') await globalThis.databaseManager.getCaseById(targetId);
		else await globalThis.databaseManager.getReportById(targetId);
	} catch (error) {
		await interaction.reply({ content: `Could not find ${targetType} #${targetId}.`, flags: MessageFlags.Ephemeral });
		return;
	}

	await interaction.showModal(buildModeratorNoteModal(`addModeratorNoteModal:${targetType}:${targetId}`));
}

async function showCaseDetails(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const kase = await globalThis.databaseManager.getCaseById(caseId);
	const reports = kase.getReports();
	const warnings = kase.getWarnings();
	const punishments = uniquePunishments([
		...kase.getPunishments(),
		...warnings.flatMap((warning) => warning.getPunishments()),
	]);

	const overview = kase.generatePrivateEmbed();
	overview.addFields(
		{ name: 'Reports', value: String(reports.length), inline: true },
		{ name: 'Warnings', value: String(warnings.length), inline: true },
		{ name: 'Punishments', value: String(punishments.length), inline: true },
	);
	await interaction.editReply({ content: `Details for Case #${caseId}`, embeds: [overview] });

	const embeds = [];
	for (const report of reports) embeds.push(await report.generatePrivateEmbed(kase.getCaseLink()));
	for (const warning of warnings) {
		embeds.push(warning.generatePrivateEmbed(kase.getCaseLink(), kase.getReporterNames()));
	}
	for (const punishment of punishments) {
		embeds.push(punishment.generatePrivateEmbed(kase.getCaseLink(), kase.getReporterNames()));
	}

	for (let index = 0; index < embeds.length; index += 9) {
		await interaction.followUp({ embeds: embeds.slice(index, index + 9) });
	}
}

function uniquePunishments(punishments) {
	const seen = new Set();
	return punishments.filter((punishment) => {
		const id = punishment.getPunishmentId();
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}

function generateCaseActionRow(caseId, { claimed = false, closed = false } = {}) {
	const claimButton = new ButtonBuilder()
		.setCustomId(`claimCaseButton:${caseId}`)
		.setLabel(claimed ? 'Claimed' : 'Claim Case')
		.setStyle(claimed ? ButtonStyle.Success : ButtonStyle.Primary)
		.setDisabled(claimed || closed);
	const createWarningButton = new ButtonBuilder()
		.setCustomId(`caseCreateWarningButton:${caseId}`)
		.setLabel('Create Warning')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(closed);
	const noteButton = new ButtonBuilder()
		.setCustomId(`caseAddNoteButton:${caseId}`)
		.setLabel('Add Note')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(closed);
	const closeButton = new ButtonBuilder()
		.setCustomId(`closeCaseButton:${caseId}`)
		.setLabel(closed ? 'Closed' : 'Close Case')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(closed);
	return new ActionRowBuilder().addComponents(claimButton, createWarningButton, noteButton, closeButton);
}

function generateCloseConfirmationRow(caseId, userId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmCloseCaseButton:${caseId}:${userId}`)
		.setLabel('Confirm Close')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelCloseCaseButton:${caseId}:${userId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return new ActionRowBuilder().addComponents(confirmButton, cancelButton);
}
