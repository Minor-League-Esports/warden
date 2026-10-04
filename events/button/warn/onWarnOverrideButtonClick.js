const log4js = require('log4js');
const logger = log4js.getLogger('onWarnOverrideButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildOverrideWarnModal } = require('../../../util/builders/ModalFunctions');

async function handleWarnOverrideButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	logger.debug(`Handling warn override button click for DB ID: ${dbId}`);
	const modal = buildOverrideWarnModal(dbId);
	await interaction.showModal(modal);
}

module.exports = {
	handleWarnOverrideButtonClick,
};
