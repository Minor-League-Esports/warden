const log4js = require('log4js');
const logger = log4js.getLogger('onReportButtonClick');
const { logLevel, moderatorRoleId } = require('../../config.json');
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
const { buildModeratorNoteModal } = require('../../util/UtilFunctions');
const { generateUserSummaryButtons } = require('../../util/builders/ButtonFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('reportUpdateButton:')) {
			const [, reportId] = buttonId.split(':');

			const modal = new ModalBuilder().setCustomId(`updateReportModal:${reportId}`).setTitle('Update Report');

			const reasonInput = new TextInputBuilder()
				.setCustomId('reason')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Please provide any additional details or updates regarding your report.')
				.setRequired(true);
			const reasonInputLabel = new LabelBuilder().setLabel('Reason for Report').setTextInputComponent(reasonInput);

			modal.addLabelComponents(reasonInputLabel);

			await interaction.showModal(modal);
		}

		if (buttonId.startsWith('reportAddNoteButton:')) {
			const [, reportId] = buttonId.split(':');
			try {
				await globalThis.databaseManager.getReportById(reportId);
				await interaction.showModal(buildModeratorNoteModal(`addModeratorNoteModal:report:${reportId}`));
			} catch (error) {
				logger.error(`Error opening note modal for report ${reportId}: ${error}`);
				await interaction.reply({ content: `Could not find Report #${reportId}.`, flags: MessageFlags.Ephemeral });
			}
		}

		if (buttonId.startsWith('closeReportButton:')) {
			const [, reportId, userId, sourceMessageId] = buttonId.split(':');
			if (interaction.user.id !== userId) {
				await interaction.reply({
					content: 'Only the moderator who started this confirmation can use it.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await interaction.update({ content: `Closing Report #${reportId}...`, components: [] });
			await closeReport(interaction, reportId, sourceMessageId);
		}
	},
};

function generateReportModButtons(reportId) {
	const createNewCaseButton = new ButtonBuilder()
		.setCustomId(`createNewCaseButton:${reportId}`)
		.setLabel('Create New Case')
		.setStyle(ButtonStyle.Success);
	const addToCaseButton = new ButtonBuilder()
		.setCustomId(`addToCaseButton:${reportId}`)
		.setLabel('Add to Case')
		.setStyle(ButtonStyle.Primary);
	const addNoteButton = new ButtonBuilder()
		.setCustomId(`reportAddNoteButton:${reportId}`)
		.setLabel('Add Note')
		.setStyle(ButtonStyle.Secondary);
	return [new ActionRowBuilder().addComponents(createNewCaseButton, addToCaseButton, addNoteButton)];
}

async function closeReport(interaction, reportId, sourceMessageId = null) {
	try {
		const { reports: closedReports } = await globalThis.databaseManager.closeReport(reportId);
		const updatedReport = await globalThis.databaseManager.getReportById(reportId);

		if (sourceMessageId) {
			const sourceMessage = await interaction.channel.messages.fetch(sourceMessageId);
			await sourceMessage.edit({
				components: [generateReportModButtons(reportId)],
			});
		}
		await notifyReporterOfClosedReport(interaction.client, updatedReport);
		await archiveThread(interaction.client, updatedReport.getReportLink(), `report ${reportId}`);

		await interaction.followUp({ content: `Report #${reportId} has been closed.` });
	} catch (error) {
		logger.error(`Error closing report ${reportId}: ${error}`);
		await interaction.followUp({ content: 'Error: Failed to close report.' });
	}
}
