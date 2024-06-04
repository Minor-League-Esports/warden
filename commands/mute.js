const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { CaseLogger } = require('../util/CaseLogger.js');
const { opsGuild, opsLogChannelId, caseLogChannelId, guildList } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('mute')
		.setDescription('Mutes a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to mute')
				.setRequired(true)
				.setMinLength(18)
				.setMaxLength(18)
		)
		.addIntegerOption((option) =>
			option
				.setName('days')
				.setDescription('The number of days to mute the user for')
				.setRequired(true)
				.setChoices(
					{ name: '7 days', value: 7 },
					{ name: '14 days', value: 14 },
					{ name: '28 days', value: 28 }
				)
		),
	async execute(interaction) {
		await interaction.deferReply();

		if (interaction.guild.id != opsGuild) {
			await interaction.editReply('This command must be run from the MLE Staff server');
			return;
		}

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
				const days = interaction.options.getInteger('days');
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
								await member.timeout(days * 24 * 60 * 60 * 1000);
								servers.set(guild.name, 'Success');
								successCount++;
							} catch (error) {
								// Failed to timeout member
								servers.set(guild.name, 'Error timing out member');

								logger.logMessage(
									`Error timing out ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``
								);
							}
						} catch (error) {
							// Failed to get member
							if (error.code === 10007) {
								servers.set(guild.name, 'Not in server');
							} else {
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
						`Failed to mute ${user.displayName} in any MLE servers. See case log for details`
					);
				} else {
					await interaction.editReply(
						`Successfully muted ${user.displayName} in ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`
					);

					// If it succeeded, send a notice to user
					const muteEmbed = createMuteEmbed(days);
					await user
						.send({ embeds: [muteEmbed] })
						.then(async function () {
							// Try to send the notice
							await interaction.followUp(`Successfully sent mute notice to ${user.displayName}`);
							// Log it
							caseLogger.logMute(user, interaction.user, servers, days, 'True');
						})
						.catch(async function (error) {
							// Send failed
							if (error.code === 50007) {
								await interaction.followUp(
									`Failed to send mute notice to ${user.displayName}\nUser has DMs disabled or the bot is blocked`
								);
							} else {
								await interaction.followUp(
									`Failed to send mute notice to ${user.displayName}, reason unknown`
								);
								logger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}
							// Log it
							caseLogger.logMute(user, interaction.user, servers, days, 'False');
						});
				}
			})
			.catch(async function (error) {
				if (error.code === 10013) {
					await interaction.editReply(`Failed to find user with ID ${userId}`);
				} else {
					await interaction.editReply('An unknown error occurred');
					logger.logMessage(`Unknown error muting ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	}
};

function createMuteEmbed(days) {
	const embed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle(`You have been muted`)
		.setTimestamp()
		.setDescription(`You have been muted in MLE for ${days} days`);
	return embed;
}
