const log4js = require('log4js');
const logger = log4js.getLogger('onWarnOverrideButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildOverrideWarnModal } = require('../../../util/builders/ModalFunctions');

async function handleWarnOverrideButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId, moderatorId, caseId] = buttonId.split(':');
	logger.debug(
		`Handling warn override button click for DB ID: ${dbId}, Moderator ID: ${moderatorId}, Case ID: ${caseId}`,
	);
	const modal = buildOverrideWarnModal(dbId, moderatorId, caseId);
	await interaction.showModal(modal);
}

module.exports = {
	handleWarnOverrideButtonClick,
};
