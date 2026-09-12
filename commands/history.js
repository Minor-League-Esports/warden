const log4js = require('log4js');
const logger = log4js.getLogger('HistoryCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('Shows the warning history of a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to view history for')
				.setRequired(true)
				.setMinLength(17)
				.setMaxLength(19),
		),
	async execute(interaction) {
		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.reply({
				content: 'This command must be run from the MLE Staff server',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply();

		const userId = interaction.options.getString('user');
		const user = await globalThis.userUtility.fetchDatabaseUser(userId);
		user.setWarnings(await globalThis.databaseManager.getWarnings(user.getUserId()));

		await interaction.editReply({
			embeds: [user.generateUserSummaryEmbed()],
			components: generateUserSummaryButtons(user.getUserId()),
		});
	},
};

function generateUserSummaryButtons(dbId) {
	const updateButton = new ButtonBuilder()
		.setCustomId(`userUpdateButton:${dbId}`)
		.setLabel('Update User')
		.setStyle(ButtonStyle.Danger);
	const viewButton = new ButtonBuilder()
		.setCustomId(`userViewHistoryButton:${dbId}`)
		.setLabel('View History')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(viewButton, updateButton);
	return [actionRow];
}
