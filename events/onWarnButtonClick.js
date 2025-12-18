const log4js = require('log4js');
const logger = log4js.getLogger('onWarnButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('userConfirmWarnButton:')) {
			const [, dbId] = buttonId.split(':');

			const modal = new ModalBuilder().setCustomId(`warnUserModal:${dbId}`).setTitle('Issue Warning to User');

			const rulesBrokenInput = new TextInputBuilder()
				.setCustomId('rulesBroken')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('1.2(1) Mildly offensive language')
				.setRequired(true);
			const rulesBrokenInputLabel = new LabelBuilder()
				.setLabel('Rule(s) Broken')
				.setTextInputComponent(rulesBrokenInput);

			const violatingContentInput = new TextInputBuilder()
				.setCustomId('violatingContent')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Direct quote or description of the violating content (shown to user)')
				.setRequired(true);
			const violatingContentInputLabel = new LabelBuilder()
				.setLabel('Violating Content')
				.setTextInputComponent(violatingContentInput);

			const pointsAddedInput = new TextInputBuilder()
				.setCustomId('pointsAdded')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('Number of points to add to user record')
				.setMinLength(1)
				.setMaxLength(2)
				.setRequired(true);
			const pointsAddedInputLabel = new LabelBuilder().setLabel('Points Added').setTextInputComponent(pointsAddedInput);

			const moderatorNotesInput = new TextInputBuilder()
				.setCustomId('moderatorNotes')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Additional notes from the moderator (not shown to user)')
				.setRequired(false);
			const moderatorNotesInputLabel = new LabelBuilder()
				.setLabel('Moderator Notes')
				.setTextInputComponent(moderatorNotesInput);

			modal.addLabelComponents(
				rulesBrokenInputLabel,
				violatingContentInputLabel,
				pointsAddedInputLabel,
				moderatorNotesInputLabel,
			);

			await interaction.showModal(modal);
		}
	},
};
