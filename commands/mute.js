const log4js = require('log4js');
const logger = log4js.getLogger('MuteCommand');
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
		.setName('mute')
		.setDescription('Mutes a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to mute')
				.setRequired(true)
				.setMinLength(17)
				.setMaxLength(19),
		)
		.addIntegerOption((option) =>
			option
				.setName('days')
				.setDescription('The number of days to mute the user for')
				.setRequired(true)
				.setChoices({ name: '7 days', value: 7 }, { name: '14 days', value: 14 }, { name: '28 days', value: 28 }),
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
		const duration = interaction.options.getInteger('days');

		const embed = generateConfirmationEmbed(user, duration);
		const components = generateConfirmationButtons(user.getUserId());
		await interaction.editReply({
			embeds: [embed],
			components,
		});
	},
};

function generateConfirmationEmbed(dbUser, duration) {
	const embed = new EmbedBuilder()
		.setTitle('Confirm Mute')
		.setDescription(
			`Are you sure you want to mute ${dbUser.getUserName()} without warning? Most mutes should be handled through /warn instead`,
		)
		.addFields({ name: 'Duration', value: `${duration} day(s)`, inline: true })
		.setColor('#ff0000')
		.setFooter({ text: `ID: ${dbUser.getDiscordId()}` })
		.setTimestamp()
		.setThumbnail(dbUser.getDiscordAvatar() ?? null);
	return embed;
}

function generateConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`muteConfirmButton:${dbId}`)
		.setLabel('Mute User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelMuteButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}
