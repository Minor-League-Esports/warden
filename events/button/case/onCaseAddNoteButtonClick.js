const log4js = require('log4js');
const logger = log4js.getLogger('onCaseAddNoteButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildCaseAddNoteModal } = require('../../../util/builders/ModalFunctions');

async function handleCaseAddNoteButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	logger.debug(`Handling case add note button click for DB ID: ${dbId}`);
	const modal = buildCaseAddNoteModal(dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleCaseAddNoteButtonClick,
};
