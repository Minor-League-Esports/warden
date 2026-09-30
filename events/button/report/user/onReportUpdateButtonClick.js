const log4js = require('log4js');
const logger = log4js.getLogger('onReportUpdateButtonClick');
const { logLevel } = require('../../../../config.json');
logger.level = logLevel;

const { buildReportUpdateModal } = require('../../../../util/builders/ModalFunctions');

async function handleReportUpdateButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	const modal = buildReportUpdateModal(dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleReportUpdateButtonClick,
};
