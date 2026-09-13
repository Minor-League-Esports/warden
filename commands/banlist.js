const log4js = require('log4js');
const logger = log4js.getLogger('BanListCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
} = require('discord.js');
const { chunkTextPreserveNewlines } = require('../util/UtilFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('banlist')
		.setDescription('Shows a list of users currently banned')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
	async execute(interaction) {
		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.reply({
				content: 'This command must be run from the MLE Staff server',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const users = await globalThis.databaseManager.getCurrentlyBannedUsers();

			if (!users || users.length === 0) {
				await interaction.editReply({ content: 'No users are currently banned.' });
				return;
			}

			const lines = users
				.sort((a, b) => a.getUserName().localeCompare(b.getUserName()))
				.map((user) => `• ${user.getUserName()} — ${user.getDiscordId()}`)
				.join('\n');

			const chunks = chunkTextPreserveNewlines(lines, 1024);
			const embeds = [];
			for (let i = 0; i < chunks.length; i++) {
				const embed = new EmbedBuilder()
					.setColor(0xff0000)
					.setTitle(i === 0 ? 'Currently Banned Users' : 'Currently Banned Users (cont.)')
					.setDescription(chunks[i]);
				embeds.push(embed);
			}

			await interaction.editReply({ embeds });
		} catch (error) {
			logger.error('Failed to fetch ban list', error);
			await interaction.editReply({ content: 'Error retrieving ban list.' });
		}
	},
};
