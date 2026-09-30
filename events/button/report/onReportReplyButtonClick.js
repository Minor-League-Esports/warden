const log4js = require('log4js');
const logger = log4js.getLogger('onReportReplyButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildReportReplyModal } = require('../../../util/builders/ModalFunctions');

async function handleReportReplyButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	const modal = buildReportReplyModal(dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleReportReplyButtonClick,
};
