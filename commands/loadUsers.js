const log4js = require('log4js');
const logger = log4js.getLogger('LoadUsersCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('loadusers')
		.setDescription('Loads users from the data source into the database')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addBooleanOption((option) =>
			option
				.setName('fetchavatars')
				.setDescription('Whether to fetch avatars for the users (this takes a LONG time)')
				.setRequired(false),
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

		const membersData = await globalThis.dataParser.getMembersData();

		let created = 0;
		let updated = 0;
		let unchanged = 0;
		let failed = 0;

		const fetchAvatars = interaction.options.getBoolean('fetchavatars') === true;

		if (fetchAvatars) {
			interaction.editReply(
				'Loading users with avatar fetching. This will take a while (30+ minutes)... A log will be sent when complete.',
			);
		}

		await Promise.all(
			membersData.map(async (member) => {
				try {
					let avatarUrl = undefined;
					if (fetchAvatars) {
						try {
							const discordUser = await interaction.client.users.fetch(member.discord_id);
							avatarUrl = discordUser.displayAvatarURL();
						} catch (_) {
							_;
							// Ignore avatar fetch failure; proceed without avatar
						}
					}

					const { action } = await globalThis.databaseManager.createUser(
						member.discord_id,
						member.name,
						member.mle_id,
						avatarUrl,
					);

					if (action === 'created') created++;
					else if (action === 'updated') updated++;
					else if (action === 'unchanged') unchanged++;
				} catch (error) {
					logger.error(`Failed to load user ${member.name} (${member.discord_id}): ${error}`);
					failed++;
				}
			}),
		);

		const message = `Created: ${created} users\nUpdated: ${updated} users\nUnchanged: ${unchanged} users\nFailed: ${failed} users\nUpdate avatars: ${fetchAvatars}`;

		if (!fetchAvatars) {
			// Fetching 5000+ avatars can cause timeout, so only edit reply if not fetching avatars
			await interaction.editReply(message);
		} else {
			globalThis.discordLogger.logMessage('LoadUsersCommand', message);
		}
	},
};
