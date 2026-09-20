const log4js = require('log4js');
const logger = log4js.getLogger('onReportModalSubmit');
const { logLevel, modmailUserId, moderatorRoleId } = require('../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { chunkTextPreserveNewlines, notifyCaseThread, getCaseLinkById } = require('../../util/UtilFunctions');

// WIP
async function handleReportUpdateModalSubmit(interaction) {
	const modalId = interaction.customId;

	if (interaction.inGuild()) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	} else {
		await interaction.deferReply();
	}

	const [, reportId] = modalId.split(':');

	// Pull fields
	const updatedReason = interaction.fields.getTextInputValue('reason').trim();
	const report = await globalThis.databaseManager.getReportById(reportId);
	const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

	// Check if the report exists and if the user is the reporter
	if (!report || report.getReporterId() !== user.getUserId()) {
		await interaction.editReply({
			content: `No report found with ID ${reportId}. Use the \`/report list\` command to see your submitted reports.`,
		});
		return;
	}

	// Add the updated reason details to the report
	report.addReasonDetails(updatedReason);

	// Get the report message URL and the updated moderator embed
	const reportMessageUrl = report.getReportLink();
	const updatedModEmbed = await report.generatePrivateEmbed(await getCaseLinkById(report.getCaseId()));

	try {
		if (!reportMessageUrl) throw new Error('No report message URL found');
		// Fetch the original report message from the report channel using the message ID extracted from the URL
		const reportMessage = await globalThis.reportChannel.messages.fetch(reportMessageUrl.split('/').pop());
		// Edit the original report message with the updated moderator embed
		await reportMessage.edit({ embeds: [updatedModEmbed] });
		// Get the thread associated with the report message
		const reportThread = reportMessage.hasThread ? reportMessage.thread : null;
		// Reply to the report thread if it exists, otherwise reply to the report message
		if (reportThread) {
			await reportThread.send(`This report has been updated with new information.`);
		} else {
			await reportMessage.reply(`This report has been updated with new information.`);
		}
	} catch (e) {
		logger.warn(`Failed to update report message for report ID ${reportId}`, e);
		// If updating the original report message fails, send a new message with the updated moderator embed
		const newMessage = await globalThis.reportChannel.send({
			content: `<@&${moderatorRoleId}>\nPlease note that the report #${reportId} submitted by <@${user.getDiscordId()}> has been updated, but I was unable to update the original report message. Here is the updated report:`,
			embeds: [updatedModEmbed],
		});
		// Update the report object with the new message URL in case the original message could not be updated
		report.setReportLink(newMessage.url);
		await globalThis.databaseManager.updateReport(report.getReportId(), { report_link: report.getReportLink() });
	}

	// Update the report in the DB with the new reason details
	await globalThis.databaseManager.updateReport(report.getReportId(), {
		report_reason: report.getReportReason(),
	});
	await notifyCaseThread(
		interaction.client,
		report.getCaseId(),
		`Report #${reportId} was updated with new information: ${report.getReportLink() ?? 'N/A'}`,
	);
	// Generate the updated user embed for the interaction reply
	const embed = await report.generateUserEmbed();
	await interaction.editReply({
		content: `Your report #${reportId} has been updated.`,
		embeds: [embed],
		components: generateReportUpdateButton(reportId),
	});
}

module.exports = {
	handleReportUpdateModalSubmit,
};
