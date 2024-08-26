const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { CaseLogger } = require('../util/CaseLogger.js');
const { opsGuild, opsLogChannelId, caseLogChannelId, guildList } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unmute')
		.setDescription('Unmutes a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to unmute')
				.setRequired(true)
				.setMinLength(17)
				.setMaxLength(19)
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
								console.error(error);
								servers.set(guild.name, 'Error removing timeout from member');

								logger.logMessage(
									`Error removing timeout from out ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``
								);
							}
						} catch (error) {
							// Failed to get member
							if (error.code === 10007) {
								servers.set(guild.name, 'Not in server');
							} else {
								console.error(error);
								servers.set(guild.name, 'Error getting member');
								logger.logMessage(
									`Error fetching member ${user}} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``
								);
							}
						}
					}
				}

				// Check if it succeeded in any servers
				if (successCount === 0) {
					await interaction.editReply(
						`Failed to unmute ${user.displayName} in any MLE servers. See case log for details`
					);
				} else {
					await interaction.editReply(
						`Successfully unmuted ${user.displayName} in ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`
					);

					// If it succeeded, send a notice to user
					const embed = createEmbed();
					await user
						.send({ embeds: [embed] })
						.then(async function () {
							// Try to send the notice
							await interaction.followUp(`Successfully sent unmute notice to ${user.displayName}`);
							// Log it
							caseLogger.logUnmute(user, interaction.user, servers, 'True');
						})
						.catch(async function (error) {
							// Send failed
							if (error.code === 50007) {
								await interaction.followUp(
									`Failed to send unmute notice to ${user.displayName}\nUser has DMs disabled or the bot is blocked`
								);
							} else {
								console.error(error);
								await interaction.followUp(
									`Failed to send unmute notice to ${user.displayName}, reason unknown`
								);
								logger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}
							// Log it
							caseLogger.logUnmute(user, interaction.user, servers, 'False');
						});
				}
			})
			.catch(async function (error) {
				if (error.code === 10013) {
					await interaction.editReply(`Failed to find user with ID ${userId}`);
				} else {
					console.error(error);
					await interaction.editReply('An unknown error occurred');
					logger.logMessage(`Unknown error unmuting ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	}
};

function createEmbed() {
	return new EmbedBuilder()
		.setColor('#00ff00')
		.setTitle(`You have been unmuted`)
		.setTimestamp()
		.setDescription(`You have been unmuted in MLE`);
}
