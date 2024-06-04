const {
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	SlashCommandBuilder,
	PermissionFlagsBits
} = require('discord.js');
const { opsGuild } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('warn')
		.setDescription('Warns a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
	async execute(interaction) {
		if (interaction.guild.id != opsGuild) {
			await interaction.reply('This command must be run from the MLE Staff server');
			return;
		}

		const modal = new ModalBuilder().setCustomId('warnModal').setTitle('Warn a User');

		const userIdInput = new TextInputBuilder()
			.setCustomId('userId')
			.setLabel('User ID')
			.setStyle(TextInputStyle.Short)
			.setMinLength(18)
			.setMaxLength(18)
			.setPlaceholder('Discord ID');

		const warnTextInput = new TextInputBuilder()
			.setCustomId('warnText')
			.setLabel('Warning Text')
			.setStyle(TextInputStyle.Paragraph).setPlaceholder(`
                Hello USER_NAME.
                ...
            `);

		const actionRowOne = new ActionRowBuilder().addComponents(userIdInput);
		const actionRowTwo = new ActionRowBuilder().addComponents(warnTextInput);

		modal.addComponents(actionRowOne, actionRowTwo);

		await interaction.showModal(modal);
	}
};
