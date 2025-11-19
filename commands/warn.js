const {
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	LabelBuilder,
} = require('discord.js');
const { opsGuild } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('warn')
		.setDescription('Warns a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
	async execute(interaction) {
		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.reply({
				content: 'This command must be run from the MLE Staff server',
			});
			return;
		}

		// Build modal
		const modal = new ModalBuilder()
			.setCustomId('warnModal')
			.setTitle('Warn a User');

		// Build user ID input
		const userIdInput = new TextInputBuilder()
			.setCustomId('userId')
			.setStyle(TextInputStyle.Short)
			.setMinLength(17)
			.setMaxLength(19)
			.setPlaceholder('Discord ID');

		// Build user ID input label
		const userIdInputLabel = new LabelBuilder()
			.setLabel('Discord ID')
			.setTextInputComponent(userIdInput);

		// Build warning text input
		const warnTextInput = new TextInputBuilder()
			.setCustomId('warnText')
			.setStyle(TextInputStyle.Paragraph).setPlaceholder(`
                Hello USER_NAME.
                ...
            `);

		// Build user ID input label
		const warnTextInputLabel = new LabelBuilder()
			.setLabel('Warn Text')
			.setTextInputComponent(warnTextInput);

		// Add action rows to modal
		modal.addLabelComponents(userIdInputLabel, warnTextInputLabel);

		// Show modal
		await interaction.showModal(modal);
	},
};
