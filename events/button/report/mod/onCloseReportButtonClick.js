const log4js = require('log4js');
const logger = log4js.getLogger('onCloseReportButtonClick');
const { logLevel } = require('../../../../config.json');
logger.level = logLevel;

const { generateCloseReportConfirmationButtons } = require('../../../../util/builders/ButtonFunctions');

async function handleCloseReportButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();
	const report = await globalThis.databaseManager.getReportById(dbId);
	if (String(report.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Report #${dbId} is already closed.` });
		return;
	}

	await interaction.editReply({
		content: `Are you sure you want to close Report #${dbId}?`,
		components: generateCloseReportConfirmationButtons(dbId, interaction.user.id),
	});
}

module.exports = {
	handleCloseReportButtonClick,
};
