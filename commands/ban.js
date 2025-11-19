const {
	EmbedBuilder,
	SlashCommandBuilder,
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
		.setName('ban')
		.setDescription('Bans a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addStringOption((option) =>
			option
				.setName('user')
				.setDescription('The Discord ID of the user to ban')
				.setRequired(true)
				.setMinLength(17)
				.setMaxLength(19),
		),
	async execute(interaction) {
		await interaction.deferReply();

		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.editReply(
				'This command must be run from the MLE Staff server',
			);
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
						if (
							!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)
						) {
							servers.set(guild.name, 'No permission');
							continue;
						}

						try {
							// Try to ban user
							await guild.members.ban(user);
							servers.set(guild.name, 'Success');
							successCount++;
						} catch (error) {
							console.error(error);
							// Ban failed
							servers.set(guild.name, 'Error banning member');

							logger.logMessage(
								`Error banning ${userId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
							);
						}
					}
				}

				// Check if it succeeded in any servers
				if (successCount === 0) {
					await interaction.editReply(
						`Failed to ban ${user.displayName} from any MLE servers. See case log for details`,
					);
				} else {
					await interaction.editReply(
						`Successfully banned ${
							user.displayName
						} from ${successCount} MLE server${
							successCount === 1 ? '' : 's'
						}. See case log for details`,
					);

					caseLogger.logBan(user, interaction.user, servers);
				}
			})
			.catch(async function (error) {
				if (error.code === 10013) {
					await interaction.editReply(`Failed to find user with ID ${userId}`);
				} else {
					console.error(error);
					await interaction.editReply('An unknown error occurred');
					logger.logMessage(
						`Unknown error banning ${userId}!\n\`\`\`\n${error}\n\`\`\``,
					);
				}
			});
	},
};
