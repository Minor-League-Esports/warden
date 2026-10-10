const log4js = require('log4js');
const logger = log4js.getLogger('onConfirmMergeUsersButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { refreshCaseMessage } = require('../../../util/message/CaseMessageFunctions');
const { refreshReportMessage } = require('../../../util/message/ReportMessageFunctions');

async function handleConfirmMergeUsersButtonClick(interaction) {
	const [, sourceId, targetId, userId] = interaction.customId.split(':');
	if (interaction.user.id !== userId) {
		await interaction.reply({
			content: 'Only the moderator who started this confirmation can use it.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply();
	try {
		const target = await globalThis.databaseManager.getUserByIdentifier(targetId, 'db');
		const moved = await globalThis.databaseManager.mergeUsers(sourceId, targetId);
		await interaction.message.edit({ components: [] });
		await interaction.editReply({
			content:
				`Merged into ${target?.getUserName() ?? `user #${targetId}`}: ` +
				`${moved.caseIds.length} case(s), ${moved.reports} report(s), ${moved.warnings} warning(s), ` +
				`${moved.punishments} punishment(s).`,
		});

		// Case messages show user names, so re-render the ones that referenced the deleted profile
		for (const caseId of moved.caseIds) {
			try {
				await refreshCaseMessage(await globalThis.databaseManager.getCaseById(caseId));
			} catch (error) {
				logger.warn(`Failed to refresh case #${caseId} after merge: ${error}`);
			}
		}

		for (const reportId of moved.reportIds) {
			try {
				await refreshReportMessage(await globalThis.databaseManager.getReportById(reportId));
			} catch (error) {
				logger.warn(`Failed to refresh report #${reportId} after merge: ${error}`);
			}
		}
	} catch (error) {
		logger.error(`Failed to merge user ${sourceId} into ${targetId}: ${error}`);
		await interaction.editReply({ content: 'Failed to merge the profiles. Nothing was changed.' });
	}
}

module.exports = {
	handleConfirmMergeUsersButtonClick,
};
