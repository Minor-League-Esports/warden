const log4js = require('log4js');
const logger = log4js.getLogger('IneligibleCommand');
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
		.setName('ineligible')
		.setDescription('Shows a list of users ineligible for staff positions (3+ points)')
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
			// Evaluate at time of command (now)
			const results = await globalThis.databaseManager.getUsersWithCurrentPointsAtOrAbove(3);

			if (!results || results.length === 0) {
				await interaction.editReply({ content: 'No users are currently ineligible (≥ 3 points).' });
				return;
			}

			// Build a list: "DisplayName — DiscordID"
			const lines = results
				.sort((a, b) => a.user.getUserName().localeCompare(b.user.getUserName()))
				.map(({ user }) => `• ${user.getUserName()} — ${user.getDiscordId()}`)
				.join('\n');

			// Discord embed description max is 4096; chunk if needed
			const chunks = chunkTextPreserveNewlines(lines, 1024);
			const embeds = [];
			for (let i = 0; i < chunks.length; i++) {
				const embed = new EmbedBuilder()
					.setColor(0xffa500)
					.setTitle(i === 0 ? 'Ineligible Users (≥ 3 points)' : 'Ineligible Users (cont.)')
					.setDescription(chunks[i]);
				embeds.push(embed);
			}

			await interaction.editReply({ embeds });
		} catch (error) {
			logger.error('Failed to build ineligible list', error);
			await interaction.editReply({ content: 'Error retrieving ineligible users.' });
		}
	},
};
