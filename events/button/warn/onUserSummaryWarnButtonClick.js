const log4js = require('log4js');
const logger = log4js.getLogger('onUserSummaryWarnButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildWarnUserModal } = require('../../../util/builders/ModalFunctions');

async function handleUserSummaryWarnButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, subjectId, caseId] = buttonId.split(':');
	const modal = buildWarnUserModal(subjectId, caseId);
	await interaction.showModal(modal);
}

module.exports = {
	handleUserSummaryWarnButtonClick,
};
