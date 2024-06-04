const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
						if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
							servers.set(guild.name, 'No permission');
							continue;
						}

						try {
							await guild.members.unban(user);
							servers.set(guild.name, 'Success');
							successCount++;
						} catch (error) {
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

				if (successCount === 0) {
					await interaction.editReply(
						`Failed to unban ${user.displayName} from any MLE servers. See case log for details`
					);
				} else {
					await interaction.editReply(
						`Successfully unbanned ${user.displayName} frorm ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`
					);
				}

				caseLogger.logUnban(user, interaction.user, servers);
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
