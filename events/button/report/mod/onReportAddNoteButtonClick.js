const log4js = require('log4js');
const logger = log4js.getLogger('onReportAddNoteButtonClick');
const { logLevel } = require('../../../../config.json');
logger.level = logLevel;

const { buildReportAddNoteModal } = require('../../../../util/builders/ModalFunctions');

async function handleReportAddNoteButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	const modal = buildReportAddNoteModal(dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleReportAddNoteButtonClick,
};
