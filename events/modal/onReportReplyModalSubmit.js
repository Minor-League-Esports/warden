const log4js = require('log4js');
const logger = log4js.getLogger('onReportReplyModalSubmit');
const { logLevel } = require('../../config.json');
logger.level = logLevel;
const { generateReportReplyConfirmationButtons } = require('../../util/builders/ButtonFunctions');

async function handleReportReplyModalSubmit(interaction) {
	const modalId = interaction.customId;

	await interaction.deferReply();

	const [, dbId] = modalId.split(':');
	const report = await globalThis.databaseManager.getReportById(dbId);
	const reply = interaction.fields.getTextInputValue('reply').trim();

	// Generate a confirmation embed, adding the reply to the "report reason"
	report.addReasonDetails(`**(MLE Moderation)**: ${reply}`);
	const embed = await report.generatePrivateEmbed();
	await interaction.editReply({
		content: 'A reply has been proposed. Confirming will send a message to the reporter',
		embeds: [embed],
		components: generateReportReplyConfirmationButtons(dbId),
	});
}

module.exports = {
	handleReportReplyModalSubmit,
};
