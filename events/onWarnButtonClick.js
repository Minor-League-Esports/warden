const log4js = require('log4js');
const logger = log4js.getLogger('onWarnButtonClick');
const { logLevel, directorRoleId } = require('../config.json');
logger.level = logLevel;

const {
	Events,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	LabelBuilder,
	TextInputStyle,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');

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

			const reporterInput = new TextInputBuilder()
				.setCustomId('reporterId')
				.setStyle(TextInputStyle.Short)
				.setMinLength(17)
				.setMaxLength(19)
				.setPlaceholder('Discord ID of reporter (e.g. 123456789012345678)')
				.setRequired(false);
			const reporterInputLabel = new LabelBuilder().setLabel('Reporter').setTextInputComponent(reporterInput);

			modal.addLabelComponents(
				rulesBrokenInputLabel,
				violatingContentInputLabel,
				pointsAddedInputLabel,
				moderatorNotesInputLabel,
				reporterInputLabel,
			);

			await interaction.showModal(modal);
		}

		if (buttonId.startsWith('executeWarnButton:')) {
			const [, dbId, moderatorId, recommendedAction] = buttonId.split(':');
			logger.debug(`Executing recommended action: ${recommendedAction} for user with DB ID: ${dbId}`);
			const buttonMessage = interaction.message;
			const proposalEmbed = buttonMessage.embeds[0];

			// Remove buttons after click
			await interaction.update({
				components: [],
			});

			if (recommendedAction === 'ban') {
				// Post approval embed
				const approvalEmbed = EmbedBuilder.from(proposalEmbed).setColor('#ff0000');
				await interaction.channel.send({
					embeds: [approvalEmbed],
					components: [generateBanApprovalButtons(dbId, moderatorId)],
					content: `<@&${directorRoleId}> please review the above ban request. Clicking "Approve Ban" will enact the ban.`,
				});
			} else {
				// Execute other punishments directly
				globalThis.punishmentExecutor
					.executePunishment(dbId, moderatorId, proposalEmbed, recommendedAction)
					.then(() => {
						logger.info(`Successfully executed ${recommendedAction} for user with DB ID: ${dbId}`);
						interaction.followUp({ content: `Successfully executed ${recommendedAction}.` });
					})
					.catch((error) => {
						logger.error(`Error executing ${recommendedAction} for user with DB ID: ${dbId}: ${error}`);
						interaction.followUp({ content: `Error executing ${recommendedAction}.` });
					});
			}
		}
	},
};

function generateBanApprovalButtons(dbId, moderatorId) {
	const approveButton = new ButtonBuilder()
		.setCustomId(`approveBanButton:${dbId}:${moderatorId}`)
		.setLabel('Approve Ban')
		.setStyle(ButtonStyle.Success);
	const denyButton = new ButtonBuilder()
		.setCustomId(`denyBanButton:${dbId}:${moderatorId}`)
		.setLabel('Deny Ban')
		.setStyle(ButtonStyle.Danger);
	return new ActionRowBuilder().addComponents(approveButton, denyButton);
}
