const log4js = require('log4js');
const logger = log4js.getLogger('onUserViewHistoryButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { buildUserHistoryCard } = require('../../../util/message/HistoryMessageFunctions');

async function handleUserViewHistoryButtonClick(interaction) {
	const [, dbId] = interaction.customId.split(':');
	await interaction.deferReply();

	try {
		const user = await globalThis.databaseManager.getUserByIdentifier(dbId, 'db');
		if (!user) {
			await interaction.editReply({ content: 'Could not find that user.' });
			return;
		}
		await interaction.editReply(await buildUserHistoryCard(user));
	} catch (error) {
		logger.error(`Failed to build history card for user ${dbId}: ${error}`);
		await interaction.editReply({ content: 'Error: Failed to retrieve user history.' });
	}
}

module.exports = {
	handleUserViewHistoryButtonClick,
};
