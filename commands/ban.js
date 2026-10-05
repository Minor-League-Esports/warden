const log4js = require('log4js');
const logger = log4js.getLogger('BanCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const {
	MessageFlags,
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	EmbedBuilder,
} = require('discord.js');
const { generateBanConfirmationButtons } = require('../util/builders/ButtonFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Bans a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to ban')
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
		const user = await globalThis.userUtility.fetchDatabaseUser(userId);

		const embed = generateConfirmationEmbed(user);
		const components = generateBanConfirmationButtons(user.getUserId());
		await interaction.editReply({
			embeds: [embed],
			components,
		});
	},
};

function generateConfirmationEmbed(dbUser) {
	const embed = new EmbedBuilder()
		.setTitle('Confirm Ban')
		.setDescription(
			`Are you sure you want to ban ${dbUser.getUserName()} without warning? Most bans should be handled through a case instead`,
		)
		.setColor('#ff0000')
		.setFooter({ text: `ID: ${dbUser.getDiscordId()}` })
		.setTimestamp()
		.setThumbnail(dbUser.getDiscordAvatar() ?? null);
	return embed;
}
