const log4js = require('log4js');
const logger = log4js.getLogger('onReportButtonClick');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { Events, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { buildModeratorNoteModal } = require('../../util/UtilFunctions');

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
	},
};
