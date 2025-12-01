const {
	EmbedBuilder,
	SlashCommandBuilder,
	InteractionContextType,
	PermissionFlagsBits,
} = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { CaseLogger } = require('../util/CaseLogger.js');
const {
	opsGuild,
	opsLogChannelId,
	caseLogChannelId,
	guildList,
} = require('../config.json');

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
				.setChoices(
					{ name: '7 days', value: 7 },
					{ name: '14 days', value: 14 },
					{ name: '28 days', value: 28 },
				),
		),
	async execute(interaction) {
		await interaction.deferReply();

		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.editReply({
				content: 'This command must be run from the MLE Staff server',
			});
			return;
		}

		// Set up loggers
		const logChannel = await interaction.client.channels.fetch(opsLogChannelId);
		const logger = new Logger(logChannel);
		const caseLogChannel = await interaction.client.channels.fetch(
			caseLogChannelId,
		);
		const caseLogger = new CaseLogger(caseLogChannel);

		// Fetch the user
		const userId = interaction.options.getString('user');
		interaction.client.users
			.fetch(userId)
			.then(async (user) => {
				// User exists, begin processing
				const days = interaction.options.getInteger('days');
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
						if (
							!guild.members.me.permissions.has(
								PermissionFlagsBits.ModerateMembers,
							)
						) {
							servers.set(guild.name, 'No permission');
							continue;
						}

						try {
							// Try to get member
							const member = await guild.members.fetch(user);

							try {
								// Try to timeout member
								await member.timeout(days * 24 * 60 * 60 * 1000);
								servers.set(guild.name, 'Success');
								successCount++;
							} catch (error) {
								console.error(error);
								// Failed to timeout member
								servers.set(guild.name, 'Error timing out member');

								logger.logMessage(
									`Error timing out ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
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
									`Error fetching member ${user}} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}
						}
					}
				}

				// Check if it succeeded in any servers
				if (successCount === 0) {
					await interaction.editReply({
						content: `Failed to mute ${user.displayName} in any MLE servers. See case log for details`,
					});
				} else {
					await interaction.editReply({
						content: `Successfully muted ${
							user.displayName
						} in ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`,
					});

					// If it succeeded, send a notice to user
					const embed = createEmbed(days);
					await user
						.send({ embeds: [embed] })
						.then(async () => {
							// Try to send the notice
							await interaction.followUp({
								content: `Successfully sent mute notice to ${user.displayName}`,
							});
							// Log it
							caseLogger.logMute(user, interaction.user, servers, days, 'True');
						})
						.catch(async (error) => {
							// Send failed
							if (error.code === 50007) {
								await interaction.followUp({
									content: `Failed to send mute notice to ${user.displayName}\nUser has DMs disabled or the bot is blocked`,
								});
							} else {
								console.error(error);
								await interaction.followUp({
									content: `Failed to send mute notice to ${user.displayName}, reason unknown`,
								});
								logger.logMessage(
									`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}
							// Log it
							caseLogger.logMute(
								user,
								interaction.user,
								servers,
								days,
								'False',
							);
						});
				}
			})
			.catch(async (error) => {
				if (error.code === 10013) {
					await interaction.editReply({
						content: `Failed to find user with ID ${userId}`,
					});
				} else {
					console.error(error);
					await interaction.editReply({ content: 'An unknown error occurred' });
					logger.logMessage(
						`Unknown error muting ${userId}!\n\`\`\`\n${error}\n\`\`\``,
					);
				}
			});
	},
};

function createEmbed(days) {
	return new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('You have been muted')
		.setTimestamp()
		.setDescription(`You have been muted in MLE for ${days} days`)
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');
}
