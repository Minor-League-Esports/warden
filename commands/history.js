const log4js = require('log4js');
const logger = log4js.getLogger('HistoryCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { buildUserSummaryButtons } = require('../util/UtilFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('Shows the warning history of a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option.setName('user').setDescription('The user to view history for (name, disc ID, MLE ID)').setRequired(true),
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
		try {
			const user = await globalThis.userUtility.fetchDatabaseUser(userId);
			user.setWarnings(await globalThis.databaseManager.getWarnings(user.getUserId()));

			await interaction.editReply({
				embeds: [user.generateUserSummaryEmbed()],
				components: buildUserSummaryButtons(user.getUserId()),
			});
		} catch (error) {
			logger.error(`Failed to fetch user history for ${userId}: ${error}`);
			if (error.message === 'User not found by any identifier.') {
				await interaction.editReply({
					content: `Could not find user ${userId}`,
				});
				return;
			}
			await interaction.editReply({
				content: 'An error occurred while fetching the user history.',
			});
			return;
		}
	},
};
