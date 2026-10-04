const log4js = require('log4js');
const logger = log4js.getLogger('onCaseCloseButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { generateCloseCaseConfirmationButtons } = require('../../../util/builders/ButtonFunctions');

async function handleCaseCloseButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();
	const caseObj = await globalThis.databaseManager.getCaseById(dbId);
	if (String(caseObj.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Case #${dbId} is already closed.` });
		return;
	}

	await interaction.editReply({
		content: `Are you sure you want to close Case #${dbId}? This will close all open reports attached to it.`,
		components: generateCloseCaseConfirmationButtons(dbId, interaction.user.id),
	});
}

module.exports = {
	handleCaseCloseButtonClick,
};
