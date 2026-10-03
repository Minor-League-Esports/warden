const log4js = require('log4js');
const logger = log4js.getLogger('CaseCommand');
const { logLevel, opsGuild, moderatorRoleId } = require('../config.json');
logger.level = logLevel;

const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');

const { assignCase } = require('../util/message/CaseMessageFunctions');
const { buildCaseAddNoteModal, buildReportAddNoteModal } = require('../util/builders/ModalFunctions');
const {
	generateCaseButtons,
	generateCloseCaseConfirmationButtons,
	generateCloseReportConfirmationButtons,
} = require('../util/builders/ButtonFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('case')
		.setDescription('Command for managing moderation reports and cases')
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
		.addSubcommand((subcommand) =>
			subcommand
				.setName('list')
				.setDescription('List all cases')
				.addStringOption((option) =>
					option
						.setName('status')
						.setDescription('Filter cases by status')
						.addChoices(
							{ name: 'All', value: 'all' },
							{ name: 'Open', value: 'open' },
							{ name: 'Closed', value: 'closed' },
						),
				),
		)
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
				.setDescription('Add a moderator note to a case')
				.addIntegerOption((option) =>
					option.setName('case_id').setDescription('The case number').setMinValue(1).setRequired(true),
				),
		)
		// Report management
		.addSubcommandGroup((subcommandGroup) =>
			subcommandGroup
				.setName('reports')
				.setDescription('Manage moderation reports')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('details')
						.setDescription('Show a report and all of its linked records')
						.addIntegerOption((option) =>
							option.setName('report_id').setDescription('The report number').setMinValue(1).setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('close')
						.setDescription('Close a report after confirmation')
						.addIntegerOption((option) =>
							option.setName('report_id').setDescription('The report number').setMinValue(1).setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('note')
						.setDescription('Add a moderator note to a report')
						.addIntegerOption((option) =>
							option.setName('report_id').setDescription('The report number').setMinValue(1).setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('list')
						.setDescription('List all reports')
						.addStringOption((option) =>
							option
								.setName('status')
								.setDescription('Filter reports by status')
								.addChoices(
									{ name: 'All', value: 'all' },
									{ name: 'Open', value: 'open' },
									{ name: 'Closed', value: 'closed' },
								),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('reply')
						.setDescription('Reply to a report')
						.addIntegerOption((option) =>
							option.setName('report_id').setDescription('The report number').setMinValue(1).setRequired(true),
						),
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

		// Get subcommand and group
		const subcommandGroup = interaction.options.getSubcommandGroup(false);
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'note') {
			await openNoteModal(interaction);
			return;
		}
		await interaction.deferReply();

		if (subcommand === 'list') {
			await listObjects(interaction);
			return;
		}

		if (subcommandGroup === 'reports') {
			if (subcommand === 'details') {
				// Handle the 'details' subcommand
			} else if (subcommand === 'close') {
				const reportId = interaction.options.getInteger('report_id');
				globalThis.databaseManager
					.getReportById(reportId)
					.then(async (reportObj) => {
						if (String(reportObj.getStatus()).toUpperCase() === 'CLOSED') {
							await interaction.editReply({ content: `Report #${reportId} is already closed.` });
							return;
						}

						await interaction.editReply({
							content: `Are you sure you want to close Report #${reportId}?`,
							components: generateCloseReportConfirmationButtons(reportId, interaction.user.id),
						});
					})
					.catch(async (error) => {
						await interaction.editReply({ content: `Could not find Report #${reportId}.` });
						logger.warn(`Error fetching report #${reportId}:`, error);
						return;
					});
			} else if (subcommand === 'note') {
				// Handle the 'note' subcommand
			} else if (subcommand === 'reply') {
				// Handle the 'reply' subcommand
			}
		} else {
			try {
				if (subcommand === 'create') {
					await createCase(interaction);
				} else if (subcommand === 'details') {
					await showCaseDetails(interaction);
				} else if (subcommand === 'assign') {
					const caseId = interaction.options.getInteger('case_id');
					globalThis.databaseManager
						.getCaseById(caseId)
						.then(async (caseObj) => {
							globalThis.userUtility
								.fetchDatabaseUser(interaction.options.getString('moderator'))
								.then(async (moderator) => {
									try {
										await assignCase(caseObj, moderator);
										await interaction.editReply({
											content: `Assigned Case #${caseId} to <@${moderator.getDiscordId()}>. All attached reports were reassigned as well.`,
										});
									} catch (error) {
										await interaction.editReply({
											content: `Failed to assign Case #${caseId} to <@${moderator.getDiscordId()}>.`,
										});
										return;
									}
								})
								.catch(async (error) => {
									await interaction.editReply({
										content: `Could not find moderator '${interaction.options.getString('moderator')}'.`,
									});
									logger.warn(`Error fetching moderator:`, error);
									return;
								});
						})
						.catch(async (error) => {
							await interaction.editReply({ content: `Could not find Case #${caseId}.` });
							logger.warn(`Error fetching case #${caseId}:`, error);
							return;
						});
				} else if (subcommand === 'close') {
					const caseId = interaction.options.getInteger('case_id');
					globalThis.databaseManager
						.getCaseById(caseId)
						.then(async (caseObj) => {
							if (String(caseObj.getStatus()).toUpperCase() === 'CLOSED') {
								await interaction.editReply({ content: `Case #${caseId} is already closed.` });
								return;
							}

							await interaction.editReply({
								content: `Are you sure you want to close Case #${caseId}? This will close all open reports attached to it.`,
								components: generateCloseCaseConfirmationButtons(caseId, interaction.user.id),
							});
						})
						.catch(async (error) => {
							await interaction.editReply({ content: `Could not find Case #${caseId}.` });
							logger.warn(`Error fetching case #${caseId}:`, error);
							return;
						});
				} else {
					await interaction.editReply({ content: 'Unknown case subcommand.' });
				}
			} catch (error) {
				logger.error(`Error executing case subcommand ${subcommand}:`, error);
				await interaction.editReply({ content: 'Unable to complete that case operation.' });
			}
		}
	},
};

async function openNoteModal(interaction) {
	const subcommandGroup = interaction.options.getSubcommandGroup(false);
	const targetType = subcommandGroup === 'reports' ? 'report' : 'case';
	const targetId =
		targetType === 'case' ? interaction.options.getInteger('case_id') : interaction.options.getInteger('report_id');
	try {
		if (targetType === 'case') {
			// Fetch the case from the database to ensure it exists before showing the modal
			await globalThis.databaseManager.getCaseById(targetId);
			await interaction.showModal(buildCaseAddNoteModal(targetId));
		} else {
			// Fetch the report from the database to ensure it exists before showing the modal
			await globalThis.databaseManager.getReportById(targetId);
			await interaction.showModal(buildReportAddNoteModal(targetId));
		}
	} catch (error) {
		await interaction.reply({ content: `Could not find ${targetType} #${targetId}.`, flags: MessageFlags.Ephemeral });
		return;
	}
}

async function listObjects(interaction) {
	const subcommandGroup = interaction.options.getSubcommandGroup(false);
	const allObjects =
		subcommandGroup === 'reports'
			? await globalThis.databaseManager.getAllReports()
			: await globalThis.databaseManager.getAllCases();
	const statusFilter = interaction.options.getString('status') ?? 'all';
	let objects = allObjects;
	if (statusFilter === 'open') {
		objects = allObjects.filter((obj) => obj.getStatus().toLowerCase() !== 'closed');
	} else if (statusFilter === 'closed') {
		objects = allObjects.filter((obj) => obj.getStatus().toLowerCase() === 'closed');
	}
	// Sort by ID
	objects.sort((a, b) => {
		if (subcommandGroup === 'reports') {
			return b.getReportId() - a.getReportId();
		} else {
			return b.getCaseId() - a.getCaseId();
		}
	});

	if (objects.length === 0) {
		if (statusFilter === 'all') {
			await interaction.editReply({
				content: `There have not been any ${subcommandGroup === 'reports' ? 'reports' : 'cases'} submitted yet.`,
			});
		} else {
			await interaction.editReply({
				content: `There are no ${statusFilter} ${subcommandGroup === 'reports' ? 'reports' : 'cases'}.`,
			});
		}
		return;
	}

	let objectList;
	if (statusFilter === 'all') {
		objectList = `All submitted ${subcommandGroup === 'reports' ? 'reports' : 'cases'}:\n`;
	} else {
		objectList = `All ${statusFilter} ${subcommandGroup === 'reports' ? 'reports' : 'cases'}:\n`;
	}

	for (const object of objects) {
		const subject = await globalThis.databaseManager.getUserByIdentifier(object.getSubjectId(), 'db');
		if (subcommandGroup === 'reports') {
			const reporter = await globalThis.databaseManager.getUserByIdentifier(object.getReporterId(), 'db');
			objectList += `- ${subcommandGroup.slice(0, -1).charAt(0).toUpperCase() + subcommandGroup.slice(1, -1).slice(1)} #${object.getReportId()} by ${reporter.getUserName()} against ${subject.getUserName()}, Status: ${object.getStatus()}\n`;
			continue;
		}

		objectList += `- Case #${object.getCaseId()} against ${subject.getUserName()}, Status: ${object.getStatus()}\n`;
	}

	objectList += `\nUse the \`/case${subcommandGroup ? ' ' + subcommandGroup : ''} details\` command with an ID to view more details about a specific case/report.`;

	if (objectList.length > 2000) {
		objectList = objectList.slice(0, 1980) + '\n... (truncated)';
	}
	await interaction.editReply({
		content: objectList,
	});
}

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
			components: generateCaseButtons(fullCase.getCaseId()),
		});
		await globalThis.databaseManager.updateCase(fullCase.getCaseId(), { case_link: caseLink });
	}

	await interaction.editReply({
		content: `Created Case #${fullCase.getCaseId()} for ${subject.getUserName()}.${caseLink ? ` ${caseLink}` : ''}`,
	});
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
