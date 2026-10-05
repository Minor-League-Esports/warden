const log4js = require('log4js');
const logger = log4js.getLogger('onCaseCreateWarningButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildWarnUserModal } = require('../../../util/builders/ModalFunctions');

async function handleCaseCreateWarningButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	const kase = await globalThis.databaseManager.getCaseById(dbId);
	const modal = buildWarnUserModal(kase.getSubjectId(), dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleCaseCreateWarningButtonClick,
};
