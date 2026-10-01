const log4js = require('log4js');
const logger = log4js.getLogger('onClaimCaseButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { acknowledgeReport } = require('../../../util/message/ReportMessageFunctions');

async function handleClaimCaseButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();
	await acknowledgeReport(dbId);
	await interaction.editReply({ content: `Report #${dbId} has been acknowledged.` });
}

module.exports = {
	handleClaimCaseButtonClick,
};
