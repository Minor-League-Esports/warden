const log4js = require('log4js');
const logger = log4js.getLogger('onReportConfirmReplyButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { replyToReport } = require('../../../util/message/ReportMessageFunctions');

async function handleReportConfirmReplyButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();

	// Get the embed from the interaction message
	const embed = interaction.message.embeds[0];
	// Find the field containing the report reason in the embed
	const reasonContent = embed.fields.find((field) => field.name === 'Report Reason')?.value;
	// Look for the text with "**(MLE Moderation)**:" in the reason content
	// There can be multiple replies so only find the latest one
	const allModerationTexts = [...reasonContent.matchAll(/\*\*\(MLE Moderation\)\*\*: (.*)/g)].map((match) => match[1]);
	const latestModerationText = allModerationTexts.pop();
	logger.debug(`Latest moderation text: ${latestModerationText}`);
	await replyToReport(interaction.client, dbId, latestModerationText);
	await interaction.editReply({
		content: `Updated report #${dbId} with the latest moderation reply.`,
	});
	await interaction.message.edit({
		content: `Updated report #${dbId} with the latest moderation reply.`,
		components: [],
	});
}

module.exports = {
	handleReportConfirmReplyButtonClick,
};
