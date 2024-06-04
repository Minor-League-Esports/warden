const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
				.setMinLength(18)
				.setMaxLength(18)
		),
	async execute(interaction) {
		await interaction.deferReply();

		if (interaction.guild.id != opsGuild) {
			await interaction.editReply('This command must be run from the MLE Staff server');
			return;
		}

		const userId = interaction.options.getString('user');
		interaction.client.users
			.fetch(userId)
			.then(async function (user) {
				const logChannel = await interaction.client.channels.fetch(opsLogChannelId);
				const logger = new Logger(logChannel);
				const caseLogChannel = await interaction.client.channels.fetch(caseLogChannelId);
				const caseLogger = new CaseLogger(caseLogChannel);

				const guildCache = interaction.client.guilds.cache;

				let servers = new Map();
				let successCount = 0;

				for (const guildId of guildList) {
					const guild = guildCache.get(guildId);
					if (guild === undefined) {
						servers.set(guildId, 'Error getting server');
					} else {
						if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
							servers.set(guild.name, 'No permission');
							continue;
						}

						try {
							const member = await guild.members.fetch(user);

							try {
								await member.timeout(0);
								servers.set(guild.name, 'Success');
								successCount++;
							} catch (error) {
								servers.set(guild.name, 'Error removing timeout of member');

								logger.logMessage(
									`Error removing timeout of ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``
								);
							}
						} catch (error) {
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
				}

				caseLogger.logunMute(user, interaction.user, servers);
			})
			.catch(async function (error) {
				if (error.code === 10013) {
					await interaction.editReply(`Failed to find user with ID ${userId}`);
				} else {
					await interaction.editReply('An unknown error occurred');
					logger.logMessage(`Unknown error unmuting ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	}
};
