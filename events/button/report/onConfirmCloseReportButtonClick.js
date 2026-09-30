const log4js = require('log4js');
const logger = log4js.getLogger('onConfirmCloseReportButtonClick');
const { logLevel } = require('../../../config.json');
const { MessageFlags } = require('discord.js');
logger.level = logLevel;

const { refreshReportMessage, closeReport } = require('../../../util/message/ReportMessageFunctions');

async function handleConfirmCloseReportButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId, userId] = buttonId.split(':');
	if (interaction.user.id !== userId) {
		await interaction.reply({
			content: 'Only the moderator who started this confirmation can use it.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	await interaction.deferReply();
	const report = await globalThis.databaseManager.getReportById(dbId);
	if (String(report.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Report #${dbId} is already closed.` });
		return;
	}
	await closeReport(interaction.client, dbId);
	await interaction.editReply({ content: `Report #${dbId} has been closed.` });
}

module.exports = {
	handleConfirmCloseReportButtonClick,
};
