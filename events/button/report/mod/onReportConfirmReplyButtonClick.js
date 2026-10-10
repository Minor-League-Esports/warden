const log4js = require('log4js');
const logger = log4js.getLogger('onReportConfirmReplyButtonClick');
const { logLevel } = require('../../../../config.json');
logger.level = logLevel;

const { replyToReport } = require('../../../../util/message/ReportMessageFunctions');

async function handleReportConfirmReplyButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();

	// Get the embed from the interaction message
	const embed = interaction.message.embeds[0];
	// Find the field containing the report reason in the embed
	const reasonContent = embed.fields.find((field) => field.name === 'Report Reason')?.value;
	const moderationMarker = '**(MLE Moderation)**: ';
	const latestModerationIndex = reasonContent.lastIndexOf(moderationMarker);
	const latestModerationText = reasonContent.slice(latestModerationIndex + moderationMarker.length);
	logger.debug(`Latest moderation text: ${latestModerationText}`);
	await replyToReport(dbId, latestModerationText);
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
