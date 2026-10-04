const log4js = require('log4js');
const logger = log4js.getLogger('onWarnButtonClick');
const { logLevel, directorRoleId } = require('../../config.json');
logger.level = logLevel;

const {
	Events,

	PermissionFlagsBits,
} = require('discord.js');
const { notifyCaseThread } = require('../../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('approveBanButton:')) {
			const [, dbId, moderatorId, caseId] = buttonId.split(':');
			const buttonMessage = interaction.message;
			const proposalEmbed = buttonMessage.embeds[0];

			// Check permissions
			if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
				logger.warn(`User ${interaction.user.id} attempted to approve a ban without sufficient permissions.`);
				await interaction.reply({ content: `<@${interaction.user.id}>, you do not have permission to approve bans.` });
				return;
			}

			// Get the director's user record
			const director = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

			// Remove buttons after click
			await interaction.update({
				components: [],
			});

			// Get the subject's user record
			const subject = await globalThis.databaseManager.getUserByIdentifier(dbId, 'db');

			// Execute ban
			globalThis.punishmentExecutor
				.execute(dbId, moderatorId, director.getUserId(), proposalEmbed, 'ban', caseId || null)
				.then(async () => {
					logger.info(`Successfully executed ban for user with DB ID: ${dbId}`);
					await interaction.followUp({ content: 'Successfully executed ban.' });
					if (caseId) {
						await notifyCaseThread(
							interaction.client,
							caseId,
							`Ban approved and executed for <@${subject.getDiscordId()}>.`,
						);
					}
					// TODO: Generate community announcement with confirmation
				})
				.catch((error) => {
					logger.error(`Error executing ban for user with DB ID: ${dbId}: ${error}`);
					interaction.followUp({ content: 'Error executing ban.' });
				});
		}
	},
};
