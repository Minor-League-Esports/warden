const log4js = require('log4js');
const logger = log4js.getLogger('onWarnConfirmButtonClick');
const { logLevel, directorRoleId } = require('../../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');
const { generateBanApprovalButtons } = require('../../../util/builders/ButtonFunctions');
const { describeAction } = require('../../../util/UtilFunctions');

async function handleWarnConfirmButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId, moderatorId, recommendedAction, caseId] = buttonId.split(':');

	const buttonMessage = interaction.message;
	const proposalEmbed = buttonMessage.embeds[0];

	// Remove buttons after click
	await interaction.update({
		components: [],
	});

	if (recommendedAction === 'ban') {
		// Post approval embed
		const approvalEmbed = EmbedBuilder.from(proposalEmbed).setColor('#ff0000');
		await interaction.followUp({
			embeds: [approvalEmbed],
			components: generateBanApprovalButtons(dbId, moderatorId, caseId),
			content: `<@&${directorRoleId}> please review the below ban request. Clicking "Approve Ban" will enact the ban. Ensure League Operations has moved the user to FP.`,
		});
	} else {
		// Get the subject's user record
		const subject = await globalThis.databaseManager.getUserByIdentifier(dbId, 'db');
		// Execute other punishments directly
		globalThis.punishmentExecutor
			.execute(dbId, moderatorId, moderatorId, proposalEmbed, recommendedAction, caseId || null)
			.then(async () => {
				logger.info(`Successfully executed ${recommendedAction} for user with DB ID: ${dbId}`);
				await interaction.followUp({
					content: `Punishment executed on <@${subject.getDiscordId()}> by <@${interaction.user.id}>: ${describeAction(recommendedAction)}`,
				});
				if (recommendedAction.includes('suspension')) {
					await interaction.followUp({
						content: `Note: Suspensions are not automatically executed by Warden yet. Please handle the suspension manually via League Operations.`,
					});
				}
			})
			.catch((error) => {
				logger.error(`Error executing ${recommendedAction} for user with DB ID: ${dbId}: ${error}`);
				interaction.followUp({ content: `Error executing ${describeAction(recommendedAction)}.` });
			});
	}
}

module.exports = {
	handleWarnConfirmButtonClick,
};
