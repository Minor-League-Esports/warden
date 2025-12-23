const log4js = require('log4js');
const logger = log4js.getLogger('onReportButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('userReportButton:')) {
			const [, dbId] = buttonId.split(':');

			const modal = new ModalBuilder().setCustomId(`reportUserModal:${dbId}`).setTitle('Report User');

			const subjectInput = new TextInputBuilder()
				.setCustomId('subject')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('TheGamingBear')
				.setRequired(true);
			const subjectLabel = new LabelBuilder().setLabel('Who are you reporting?').setTextInputComponent(subjectInput);

			const reasonInput = new TextInputBuilder()
				.setCustomId('reason')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('What rule(s) did they break and why are you reporting them?')
				.setRequired(true);
			const reasonInputLabel = new LabelBuilder().setLabel('Reason for Report').setTextInputComponent(reasonInput);

			const evidenceInput = new TextInputBuilder()
				.setCustomId('evidence')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Paste links here if available. You can attach files in the next step after you submit.')
				.setRequired(false);
			const evidenceInputLabel = new LabelBuilder().setLabel('Evidence (if any)').setTextInputComponent(evidenceInput);

			modal.addLabelComponents(subjectLabel, reasonInputLabel, evidenceInputLabel);

			await interaction.showModal(modal);
		}

		if (buttonId.startsWith('confirmReportSubmit:')) {
			const [, subjectId, reporterId] = buttonId.split(':');
			await interaction.deferReply();

			try {
				await globalThis.reportUtility.submitReportFromInteraction(interaction, subjectId, reporterId);
				await interaction.editReply({
					content: 'Your report has been submitted to MLE Moderation. Thank you for helping keep the community safe!',
				});
			} catch (error) {
				logger.error(`Error submitting report: ${error}`);
				await interaction.editReply({
					content: 'There was an error submitting your report. Please try again later.',
				});
			}
		}
	},
};
