const log4js = require('log4js');
const logger = log4js.getLogger('ReportMessageFunctions');
const { moderatorRoleId, logLevel } = require('../../config.json');
logger.level = logLevel;

const { ChannelType } = require('discord.js');
const { generateUserSummaryButtons, generateReportModButtons } = require('../builders/ButtonFunctions');

async function createReportMessage(reportObj) {
	// Fetch the report
	let fullReport = await globalThis.databaseManager.getReportById(reportObj.getReportId());
	// Get the subject mention for the report message
	const subjectMention = fullReport.getSubjectUser() ? `<@${fullReport.getSubjectUser().getDiscordId()}>` : 'Unknown';
	// Create a private thread for the report discussion among moderators
	// We do this first to ensure that the discussion thread exists before posting the report message
	// This way we don't have to update the original report embed after creating the thread
	const reportThread = await globalThis.reportChannel.threads.create({
		name: `Report #${fullReport.getReportId()} (${fullReport.getSubjectUser()?.getUserName() ?? 'Unknown'})`,
		type: ChannelType.PrivateThread,
	});
	// Update the report with the thread link
	fullReport = await globalThis.databaseManager.updateReport(fullReport.getReportId(), {
		report_thread_link: reportThread.url,
	});
	// Generate the private embed for the report message
	const reportEmbed = fullReport.generatePrivateEmbed();
	// Send the report message to the report channel
	const reportMessage = await globalThis.reportChannel.send({
		content: `Report #${fullReport.getReportId()} | ${subjectMention}`,
		embeds: [reportEmbed],
	});
	// Update the report with the message link
	fullReport = await globalThis.databaseManager.updateReport(fullReport.getReportId(), {
		report_link: reportMessage.url,
	});
	// Send a notification to the report thread about the new report
	const reportThreadMessage = await reportThread.send({
		content: `<@&${moderatorRoleId}> A new report has been submitted.`,
		embeds: [reportEmbed],
		components: [generateReportModButtons(fullReport.getReportId())],
	});
	// Pin the report thread message to make it easily accessible for moderators
	await reportThreadMessage
		.pin()
		.catch((error) => logger.warn(`Could not pin Report #${fullReport.getReportId()} message: ${error}`));

	try {
		const [warnings, cases] = await Promise.all([
			globalThis.databaseManager.getWarnings(fullReport.getSubjectId()),
			globalThis.databaseManager.getCasesBySubjectId(fullReport.getSubjectId()),
		]);
		const subject = fullReport.getSubjectUser();
		subject.setWarnings(warnings);
		subject.setCases(cases);
		await reportThread.send({
			embeds: [subject.generateUserSummaryEmbed()],
			components: [generateUserSummaryButtons(subject.getUserId())],
		});
	} catch (historyError) {
		logger.error(`Failed to add subject history to report ${fullReport.getReportId()} thread: ${historyError}`);
	}
}

module.exports = {
	createReportMessage,
};
