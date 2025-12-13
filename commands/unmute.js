const log4js = require('log4js');
const logger = log4js.getLogger('UnmuteCommand');
const { logLevel, opsGuild, guildList } = require('../config.json');
logger.level = logLevel;

const {
	MessageFlags,
	EmbedBuilder,
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unmute')
		.setDescription('Unmutes a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to unmute')
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
						if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
							servers.set(guild.name, 'No permission');
							continue;
						}

						try {
							// Try to get member
							const member = await guild.members.fetch(user);

							try {
								// Try to timeout member
								await member.timeout(1);
								servers.set(guild.name, 'Success');
								successCount++;
							} catch (error) {
								// Failed to timeout member
								logger.error(error);
								servers.set(guild.name, 'Error removing timeout from member');

								globalThis.discordLogger.logMessage(
									`Error removing timeout from out ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}
						} catch (error) {
							// Failed to get member
							if (error.code === 10007) {
								servers.set(guild.name, 'Not in server');
							} else {
								logger.error(error);
								servers.set(guild.name, 'Error getting member');
								globalThis.discordLogger.logMessage(
									`Error fetching member ${user}} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}
						}
					}
				}

				// Check if it succeeded in any servers
				if (successCount === 0) {
					await interaction.editReply({
						content: `Failed to unmute ${user.displayName} in any MLE servers. See case log for details`,
					});
				} else {
					await interaction.editReply({
						content: `Successfully unmuted ${user.displayName} in ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`,
					});

					// If it succeeded, send a notice to user
					const embed = createEmbed();
					await user
						.send({ embeds: [embed] })
						.then(async () => {
							// Try to send the notice
							await interaction.followUp({
								content: `Successfully sent unmute notice to ${user.displayName}`,
							});
							// Log it
							globalThis.caseLogger.logUnmute(user, interaction.user, servers, 'True');
						})
						.catch(async (error) => {
							// Send failed
							if (error.code === 50007) {
								await interaction.followUp({
									content: `Failed to send unmute notice to ${user.displayName}\nUser has DMs disabled or the bot is blocked`,
								});
							} else {
								logger.error(error);
								await interaction.followUp({
									content: `Failed to send unmute notice to ${user.displayName}, reason unknown`,
								});
								globalThis.discordLogger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}
							// Log it
							globalThis.caseLogger.logUnmute(user, interaction.user, servers, 'False');
						});
				}
			})
			.catch(async (error) => {
				if (error.code === 10013) {
					await interaction.editReply({
						content: `Failed to find user with ID ${userId}`,
					});
				} else {
					logger.error(error);
					await interaction.editReply({ content: 'An unknown error occurred' });
					globalThis.discordLogger.logMessage(`Unknown error unmuting ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	},
};

function createEmbed() {
	return new EmbedBuilder()
		.setColor('#00ff00')
		.setTitle('You have been unmuted')
		.setTimestamp()
		.setDescription('You have been unmuted in MLE')
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');
}
