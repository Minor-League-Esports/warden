const {
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require('discord.js');
const { opsGuild } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('warn')
		.setDescription('Warns a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
	async execute(interaction) {
		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.reply(
				'This command must be run from the MLE Staff server',
			);
			return;
		}

		// Build modal
		const modal = new ModalBuilder()
			.setCustomId('warnModal')
			.setTitle('Warn a User');

		// Build user ID input
		const userIdInput = new TextInputBuilder()
			.setCustomId('userId')
			.setLabel('User ID')
			.setStyle(TextInputStyle.Short)
			.setMinLength(17)
			.setMaxLength(19)
			.setPlaceholder('Discord ID');

		// Build warning text input
		const warnTextInput = new TextInputBuilder()
			.setCustomId('warnText')
			.setLabel('Warning Text')
			.setStyle(TextInputStyle.Paragraph).setPlaceholder(`
                Hello USER_NAME.
                ...
            `);

		// Create action rows
		const actionRowOne = new ActionRowBuilder().addComponents(userIdInput);
		const actionRowTwo = new ActionRowBuilder().addComponents(warnTextInput);

		// Add action rows to modal
		modal.addComponents(actionRowOne, actionRowTwo);

		// Show modal
		await interaction.showModal(modal);
	},
};
