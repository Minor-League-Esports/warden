const log4js = require('log4js');
const logger = log4js.getLogger('onClaimCaseButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { assignCase } = require('../../../util/message/CaseMessageFunctions');

async function handleClaimCaseButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();
	const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
	const fullCase = await globalThis.databaseManager.getCaseById(dbId);
	await assignCase(fullCase, user);
	await interaction.editReply({ content: `Case #${dbId} has been claimed by <@${user.getDiscordId()}>.` });
}

module.exports = {
	handleClaimCaseButtonClick,
};
