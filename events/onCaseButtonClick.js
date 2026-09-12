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
const { notifyCaseThread, refreshReportMessage, acknowledgeReport } = require('../util/UtilFunctions');

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
						content: `Case #${fullCase.getCaseId()} opened for ${subjectMention} (from Report #${reportId})`,
						embeds: [caseEmbed],
						components: [generateClaimButtonRow(fullCase.getCaseId())],
					});
					const caseThread = await caseMessage.startThread({
						name: `Case #${fullCase.getCaseId()} (${fullCase.getSubjectUser()?.getUserName() ?? 'Unknown'})`,
					});
					await caseThread.send(`<@&${moderatorRoleId}> A new case has been opened.`);
					await globalThis.databaseManager.updateCase(fullCase.getCaseId(), { case_link: caseMessage.url });
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
						components: [generateClaimedButtonRow(caseId)],
					});
					await interaction.followUp({
						content: `Case #${caseId} claimed by <@${interaction.user.id}>. All reports attached to this case have been reassigned to this moderator.`,
					});
				} catch (error) {
					logger.error(`Error claiming case ${caseId}: ${error}`);
					await interaction.followUp({ content: 'Error: Failed to claim case.' });
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

function generateClaimButtonRow(caseId) {
	const claimButton = new ButtonBuilder()
		.setCustomId(`claimCaseButton:${caseId}`)
		.setLabel('Claim Case')
		.setStyle(ButtonStyle.Primary);
	return new ActionRowBuilder().addComponents(claimButton);
}

function generateClaimedButtonRow(caseId) {
	const claimedButton = new ButtonBuilder()
		.setCustomId(`claimCaseButton:${caseId}`)
		.setLabel('Claimed')
		.setStyle(ButtonStyle.Success)
		.setDisabled(true);
	return new ActionRowBuilder().addComponents(claimedButton);
}
