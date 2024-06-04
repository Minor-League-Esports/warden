const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { CaseLogger } = require('../util/CaseLogger.js');
const { opsGuild, opsLogChannelId, caseLogChannelId, guildList } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unban')
		.setDescription('Unbans a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to unban')
				.setRequired(true)
				.setMinLength(18)
				.setMaxLength(18)
		),
	async execute(interaction) {
		await interaction.deferReply();

		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.editReply('This command must be run from the MLE Staff server');
			return;
		}

		// Set up loggers
		const logChannel = await interaction.client.channels.fetch(opsLogChannelId);
		const logger = new Logger(logChannel);
		const caseLogChannel = await interaction.client.channels.fetch(caseLogChannelId);
		const caseLogger = new CaseLogger(caseLogChannel);

		// Fetch the user
		const userId = interaction.options.getString('user');
		interaction.client.users
			.fetch(userId)
			.then(async function (user) {
				// User exists, begin processing
				const guildCache = interaction.client.guilds.cache;

				let servers = new Map();
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
								servers.set(guild.name, 'Error unbanning member');

								logger.logMessage(
									`Error unbanning ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``
								);
							}
						}
					}
				}

				// Check if it succeeded in any servers
				if (successCount === 0) {
					await interaction.editReply(
						`Failed to unban ${user.displayName} from any MLE servers. See case log for details`
					);
				} else {
					await interaction.editReply(
						`Successfully unbanned ${user.displayName} from ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`
					);

					// If it succeeded, send a notice to user
					const embed = createEmbed();
					await user
						.send({ embeds: [embed] })
						.then(async function () {
							// Try to send the notice
							await interaction.followUp(`Successfully sent unban notice to ${user.displayName}`);
							// Log it
							caseLogger.logBan(user, interaction.user, servers, 'True');
						})
						.catch(async function (error) {
							// Send failed
							if (error.code === 50007) {
								await interaction.followUp(
									`Failed to send unban notice to ${user.displayName}\nUser has DMs disabled or the bot is blocked`
								);
							} else {
								await interaction.followUp(
									`Failed to send unban notice to ${user.displayName}, reason unknown`
								);
								logger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}
							// Log it
							caseLogger.logBan(user, interaction.user, servers, 'False');
						});
				}
			})
			.catch(async function (error) {
				if (error.code === 10013) {
					await interaction.editReply(`Failed to find user with ID ${userId}`);
				} else {
					await interaction.editReply('An unknown error occurred');
					logger.logMessage(`Unknown error unbanning ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	}
};

return new EmbedBuilder()
	.setColor('#00ff00')
	.setTitle(`You have been unbanned`)
	.setTimestamp()
	.setDescription(`You have been unbanned from MLE`);
