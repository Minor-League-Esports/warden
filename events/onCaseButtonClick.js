const log4js = require('log4js');
const logger = log4js.getLogger('onCaseButtonClick');
const { logLevel, moderatorRoleId } = require('../config.json');
logger.level = logLevel;

const {
	Events,
	ModalBuilder,
	TextInputBuilder,
	LabelBuilder,
	TextInputStyle,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const {
	notifyCaseThread,
	refreshReportMessage,
	acknowledgeReport,
	buildWarnUserModal,
} = require('../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isButton()) {
			const buttonId = interaction.customId;

			if (buttonId.startsWith('createNewCaseButton:')) {
				const [, reportId] = buttonId.split(':');

				await interaction.deferUpdate();

				try {
					const report = await globalThis.databaseManager.getReportById(reportId);
					if (!report) {
						logger.warn(`Report not found for ID: ${reportId}`);
						await interaction.followUp({ content: `Error: Report #${reportId} not found.` });
						return;
					}

					const moderator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

					const newCase = await globalThis.databaseManager.createCase(
						moderator.getUserId(),
						report.getSubjectId(),
						'OPEN',
						new Date().toISOString(),
					);
					await globalThis.databaseManager.attachReportToCase(reportId, newCase.getCaseId());

					// Post the case to the case channel with a thread for moderator discussion
					const fullCase = await globalThis.databaseManager.getCaseById(newCase.getCaseId());
					const caseEmbed = fullCase.generatePrivateEmbed();
					const subjectMention = fullCase.getSubjectUser()
						? `<@${fullCase.getSubjectUser().getDiscordId()}>`
						: 'Unknown';
					const caseMessage = await globalThis.caseChannel.send({
						content: `Case #${fullCase.getCaseId()} | ${subjectMention}`,
						embeds: [caseEmbed],
					});
					const caseThread = await caseMessage.startThread({
						name: `Case #${fullCase.getCaseId()} (${fullCase.getSubjectUser()?.getUserName() ?? 'Unknown'})`,
					});
					await globalThis.databaseManager.updateCase(fullCase.getCaseId(), { case_link: caseMessage.url });
					await caseThread.send({
						content: `<@&${moderatorRoleId}> A new case has been opened.`,
						embeds: [caseEmbed],
						components: [generateCaseActionRow(fullCase.getCaseId())],
					});
					await notifyCaseThread(
						interaction.client,
						fullCase.getCaseId(),
						`Report #${reportId} attached: ${report.getReportLink() ?? 'N/A'}`,
					);

					// Acknowledging the report is implied by assigning it to a case
					const updatedReport = await acknowledgeReport(interaction.client, reportId);
					await refreshReportMessage(interaction.client, updatedReport, caseMessage.url);

					// Remove the case buttons now that the report has been assigned to a case
					await interaction.message.edit({ components: [] });
					await interaction.followUp({
						content: `Created Case #${newCase.getCaseId()} and attached Report #${reportId} to it. See ${caseMessage.url}`,
					});
				} catch (error) {
					logger.error(`Error creating case for report ${reportId}: ${error}`);
					await interaction.followUp({ content: 'Error: Failed to create a new case.' });
				}
				return;
			}

			if (buttonId.startsWith('addToCaseButton:')) {
				const [, reportId] = buttonId.split(':');

				const modal = new ModalBuilder()
					.setCustomId(`attachReportToCaseModal:${reportId}`)
					.setTitle('Add Report to Case');

				const caseIdInput = new TextInputBuilder()
					.setCustomId('caseId')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('e.g. 42')
					.setMinLength(1)
					.setMaxLength(10)
					.setRequired(true);
				const caseIdLabel = new LabelBuilder()
					.setLabel('Case ID to attach this report to')
					.setTextInputComponent(caseIdInput);

				modal.addLabelComponents(caseIdLabel);

				await interaction.showModal(modal);
				return;
			}

			if (buttonId.startsWith('claimCaseButton:')) {
				const [, caseId] = buttonId.split(':');

				await interaction.deferUpdate();

				try {
					const moderator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
					await globalThis.databaseManager.claimCase(caseId, moderator.getUserId());

					const updatedCase = await globalThis.databaseManager.getCaseById(caseId);
					await interaction.message.edit({
						embeds: [updatedCase.generatePrivateEmbed()],
						components: [generateCaseActionRow(caseId, { claimed: true })],
					});
					await refreshCaseSummary(updatedCase);
					await interaction.followUp({
						content: `Case #${caseId} claimed by <@${interaction.user.id}>. All reports attached to this case have been reassigned to this moderator.`,
					});
				} catch (error) {
					logger.error(`Error claiming case ${caseId}: ${error}`);
					await interaction.followUp({ content: 'Error: Failed to claim case.' });
				}
				return;
			}

			if (buttonId.startsWith('caseCreateWarningButton:')) {
				const [, caseId] = buttonId.split(':');

				try {
					const kase = await globalThis.databaseManager.getCaseById(caseId);
					const modal = buildWarnUserModal(`warnUserModal:${kase.getSubjectId()}:${caseId}`);
					await interaction.showModal(modal);
				} catch (error) {
					logger.error(`Error opening warn modal for case ${caseId}: ${error}`);
					await interaction.reply({
						content: 'Error: Failed to open the warning form for this case.',
						flags: MessageFlags.Ephemeral,
					});
				}
				return;
			}

			if (buttonId.startsWith('closeCaseButton:')) {
				const [, caseId] = buttonId.split(':');

				await interaction.deferUpdate();

				try {
					const { reports: closedReports } = await globalThis.databaseManager.closeCase(caseId);

					const updatedCase = await globalThis.databaseManager.getCaseById(caseId);
					await interaction.message.edit({
						embeds: [updatedCase.generatePrivateEmbed()],
						components: [generateCaseActionRow(caseId, { claimed: !!updatedCase.getModerator(), closed: true })],
					});
					await refreshCaseSummary(updatedCase);
					await notifyCaseThread(
						interaction.client,
						caseId,
						`Case #${caseId} has been closed by <@${interaction.user.id}>.`,
					);
					await Promise.all(
						closedReports.map((report) =>
							notifyReporterOfClosedCase(interaction.client, report, caseId, updatedCase.getCaseLink()),
						),
					);
					await Promise.all([
						archiveThread(interaction.client, updatedCase.getCaseLink(), `case ${caseId}`),
						...updatedCase
							.getReports()
							.map((report) => archiveThread(interaction.client, report.getReportLink(), `report ${report.getReportId()}`)),
					]);

					await interaction.followUp({ content: `Case #${caseId} has been closed.` });
				} catch (error) {
					logger.error(`Error closing case ${caseId}: ${error}`);
					await interaction.followUp({ content: 'Error: Failed to close case.' });
				}
				return;
			}
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('attachReportToCaseModal:')) {
			const [, reportId] = interaction.customId.split(':');
			const caseIdInput = interaction.fields.getTextInputValue('caseId').trim();
			const caseId = Number.parseInt(caseIdInput, 10);

			if (Number.isNaN(caseId)) {
				await interaction.reply({
					content: 'Error: Case ID must be a valid number.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await interaction.deferReply();

			try {
				// Confirms the case exists before attaching (throws if not found)
				const targetCase = await globalThis.databaseManager.getCaseById(caseId);
				await globalThis.databaseManager.attachReportToCase(reportId, caseId);

				const report = await globalThis.databaseManager.getReportById(reportId);
				await notifyCaseThread(
					interaction.client,
					caseId,
					`Report #${reportId} attached: ${report?.getReportLink() ?? 'N/A'}`,
				);

				// Acknowledging the report is implied by assigning it to a case
				const updatedReport = await acknowledgeReport(interaction.client, reportId);
				await refreshReportMessage(interaction.client, updatedReport, targetCase.getCaseLink());

				if (interaction.isFromMessage()) {
					await interaction.message.edit({ components: [] });
				}

				await interaction.editReply({ content: `Attached Report #${reportId} to Case #${caseId}.` });
			} catch (error) {
				logger.error(`Error attaching report ${reportId} to case ${caseId}: ${error}`);
				await interaction.editReply({ content: `Error: Could not find or attach to Case #${caseId}.` });
			}
		}
	},
};

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
	const closeButton = new ButtonBuilder()
		.setCustomId(`closeCaseButton:${caseId}`)
		.setLabel(closed ? 'Closed' : 'Close Case')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(closed);
	return new ActionRowBuilder().addComponents(claimButton, createWarningButton, closeButton);
}

async function refreshCaseSummary(kase) {
	if (!kase.getCaseLink()) return;
	const messageId = kase.getCaseLink().split('/').pop();
	const caseMessage = await globalThis.caseChannel.messages.fetch(messageId);
	await caseMessage.edit({ embeds: [kase.generatePrivateEmbed()], components: [] });
}

async function notifyReporterOfClosedCase(client, report, caseId, caseLink) {
	try {
		await refreshReportMessage(client, report, caseLink);
		const reporter = await globalThis.databaseManager.getUserByIdentifier(report.getReporterId(), 'db');
		if (!reporter) throw new Error('Reporter not found');
		const discordUser = await client.users.fetch(reporter.getDiscordId());
		const reportEmbed = await report.generateUserEmbed();
		await discordUser.send({
			content: `MLE Moderation has reviewed your report #${report.getReportId()} and concluded its investigation. Thank you for helping us maintain a safe community.`,
			embeds: [reportEmbed],
		});
	} catch (error) {
		logger.warn(`Could not notify reporter for closed report ${report.getReportId()}: ${error}`);
	}
}

async function archiveThread(client, parentMessageLink, description) {
	if (!parentMessageLink) return;
	try {
		const thread = await client.channels.fetch(parentMessageLink.split('/').pop());
		if (thread?.setArchived) await thread.setArchived(true);
	} catch (error) {
		logger.warn(`Failed to archive thread for ${description}: ${error}`);
	}
}
