const log4js = require('log4js');
const logger = log4js.getLogger('onConfirmCloseCaseButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { closeCase, closeCaseThread } = require('../../../util/message/CaseMessageFunctions');

async function handleConfirmCloseCaseButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId, userId] = buttonId.split(':');
	if (interaction.user.id !== userId) {
		await interaction.reply({
			content: 'Only the moderator who started this confirmation can use it.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	await interaction.deferReply();
	const caseObj = await globalThis.databaseManager.getCaseById(dbId);
	if (String(caseObj.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Case #${dbId} is already closed.` });
		return;
	}
	await closeCase(caseObj);
	await interaction.editReply({ content: `Case #${dbId} has been closed.` });
	// Remove buttons from the prompt message
	await interaction.message.edit({
		components: [],
	});
	// Finally, close the thread
	await closeCaseThread(caseObj);
}

module.exports = {
	handleConfirmCloseCaseButtonClick,
};
