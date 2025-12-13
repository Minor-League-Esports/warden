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
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
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

		await Promise.all(
			membersData.map((member) =>
				globalThis.databaseManager
					.createUser(member.discord_id, member.name, member.mle_id)
					.then(({ action }) => {
						if (action === 'created') created++;
						else if (action === 'updated') updated++;
						else if (action === 'unchanged') unchanged++;
					})
					.catch((error) => {
						logger.error(`Failed to load user ${member.name} (${member.discord_id}): ${error}`);
						failed++;
					}),
			),
		);

		const message = `Created: ${created} users\nUpdated: ${updated} users\nUnchanged: ${unchanged} users\nFailed: ${failed} users`;

		await interaction.editReply(message);
	},
};
