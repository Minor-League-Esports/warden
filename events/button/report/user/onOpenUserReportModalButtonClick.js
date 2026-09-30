const log4js = require('log4js');
const logger = log4js.getLogger('onOpenUserReportModalButtonClick');
const { logLevel } = require('../../../../config.json');
logger.level = logLevel;

const { buildReportUserModal } = require('../../../../util/builders/ModalFunctions');

async function handleOpenUserReportModalButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	const modal = buildReportUserModal(dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleOpenUserReportModalButtonClick,
};
