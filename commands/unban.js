const log4js = require('log4js');
const logger = log4js.getLogger('UnbanCommand');
const { logLevel, opsGuild, guildList } = require('../config.json');
logger.level = logLevel;

const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unban')
		.setDescription('Unbans a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to unban')
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
		interaction.client.users
			.fetch(userId)
			.then(async (user) => {
				// User exists, begin processing
				const guildCache = interaction.client.guilds.cache;

				const servers = new Map();
				let successCount = 0;

				// Loop through all servers
				for (const guildId of guildList) {
					const guild = guildCache.get(guildId);
					// Try to get server
					if (guild === undefined) {
						servers.set(guildId, 'Error getting server');
					} else {
						// Check for permission
						if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
							servers.set(guild.name, 'No permission');
							continue;
						}

						try {
							// Try to unban user
							await guild.members.unban(user);
							servers.set(guild.name, 'Success');
							successCount++;
						} catch (error) {
							// Failed to unban
							if (error.code === 10026) {
								servers.set(guild.name, 'Not banned');
							} else {
								logger.error(error);
								servers.set(guild.name, 'Error unbanning member');

								globalThis.discordLogger.logMessage(
									`Error unbanning ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}
						}
					}
				}

				// Check if it succeeded in any servers
				if (successCount === 0) {
					await interaction.editReply({
						content: `Failed to unban ${user.displayName} from any MLE servers. See case log for details`,
					});
				} else {
					await interaction.editReply({
						content: `Successfully unbanned ${user.displayName} from ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`,
					});
				}
				globalThis.caseLogger.logUnban(user, interaction.user, servers);
			})
			.catch(async (error) => {
				if (error.code === 10013) {
					await interaction.editReply({
						content: `Failed to find user with ID ${userId}`,
					});
				} else {
					logger.error(error);
					await interaction.editReply({ content: 'An unknown error occurred' });
					globalThis.discordLogger.logMessage(`Unknown error unbanning ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	},
};
