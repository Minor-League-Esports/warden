const log4js = require('log4js');
const logger = log4js.getLogger('onApproveBanButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { PermissionFlagsBits } = require('discord.js');
const { describeAction } = require('../../../util/UtilFunctions');

async function handleApproveBanButtonClick(interaction) {
	// Check permissions
	if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
		logger.warn(`User ${interaction.user.id} attempted to approve a ban without sufficient permissions.`);
		await interaction.reply({ content: 'You do not have permission to approve bans.' });
		return;
	}

	// Remove buttons after click
	await interaction.update({
		components: [],
	});

	const buttonMessage = interaction.message;
	const proposalEmbed = buttonMessage.embeds[0];
	const buttonId = interaction.customId;
	const [, dbId, moderatorId, caseId] = buttonId.split(':');
	// Get the director's user record
	const director = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

	// Get the subject's user record
	const subject = await globalThis.databaseManager.getUserByIdentifier(dbId, 'db');

	// Execute ban
	globalThis.punishmentExecutor
		.execute(dbId, moderatorId, director.getUserId(), proposalEmbed, 'ban', caseId || null)
		.then(async () => {
			logger.info(`Successfully executed ban for user with DB ID: ${dbId}`);
			await interaction.followUp({
				content: `Punishment executed on <@${subject.getDiscordId()}> by <@${interaction.user.id}>: ${describeAction('ban')}`,
			});
		})
		.catch((error) => {
			logger.error(`Error executing ban for user with DB ID: ${dbId}: ${error}`);
			interaction.followUp({ content: 'Error executing ban.' });
		});
}

module.exports = {
	handleApproveBanButtonClick,
};
