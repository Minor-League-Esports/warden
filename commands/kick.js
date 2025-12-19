const log4js = require('log4js');
const logger = log4js.getLogger('UnmuteCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const {
	MessageFlags,
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	EmbedBuilder,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Kicks a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to kick')
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

		// Fetch the user
		const userId = interaction.options.getString('user');
		const user = await globalThis.userUtility.fetchDatabaseUserByDiscordId(userId);

		const embed = generateConfirmationEmbed(user);
		const components = generateConfirmationButtons(user.getUserId());
		await interaction.editReply({
			embeds: [embed],
			components,
		});
	},
};

function generateConfirmationEmbed(dbUser) {
	const embed = new EmbedBuilder()
		.setTitle('Confirm Kick')
		.setDescription(`Are you sure you want to kick ${dbUser.getUserName()}?`)
		.setColor('#ff0000')
		.setFooter({ text: `ID: ${dbUser.getDiscordId()}` })
		.setTimestamp()
		.setThumbnail(dbUser.getDiscordAvatar() ?? null);
	return embed;
}

function generateConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`kickConfirmButton:${dbId}`)
		.setLabel('Kick User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelKickButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}
