const log4js = require('log4js');
const logger = log4js.getLogger('ReportMessageFunctions');
const { moderatorRoleId, logLevel } = require('../../config.json');
logger.level = logLevel;

const { ChannelType } = require('discord.js');
const { generateUserSummaryButtons, generateReportModButtons } = require('../builders/ButtonFunctions');

async function createReportMessage(reportObj, caseObj = null) {
	// Fetch the report
	const fullReport = await globalThis.databaseManager.getReportById(reportObj.getReportId());
	// Capture the subject now; updateReport below returns a fresh object without joined user data
	const subjectUser = fullReport.getSubjectUser();
	// Get the subject mention for the report message
	const subjectMention = subjectUser ? `<@${subjectUser.getDiscordId()}>` : 'Unknown';
	// Create a private thread for the report discussion among moderators
	// We do this first to ensure that the discussion thread exists before posting the report message
	// This way we don't have to update the original report embed after creating the thread
	const reportThread = await globalThis.reportChannel.threads.create({
		name: `Report #${fullReport.getReportId()} (${subjectUser?.getUserName() ?? 'Unknown'})`,
		type: ChannelType.PrivateThread,
	});
	// Update the report with the thread link
	fullReport.setReportThreadLink(reportThread.url);
	await globalThis.databaseManager.updateReport(fullReport.getReportId(), {
		report_thread_link: reportThread.url,
	});
	// Generate the private embed for the report message
	logger.debug(`Case thread link: ${caseObj?.getCaseThreadLink()}`);
	logger.debug(caseObj);
	const reportSummary = await fullReport.generateSummaryEmbed(caseObj?.getCaseThreadLink());

	// Send the report message to the report channel
	const reportMessage = await globalThis.reportChannel.send({
		content: `Report #${fullReport.getReportId()} | ${subjectMention}`,
		embeds: [reportSummary],
	});
	// Update the report with the message link
	fullReport.setReportLink(reportMessage.url);
	await globalThis.databaseManager.updateReport(fullReport.getReportId(), {
		report_link: reportMessage.url,
	});
	const reportEmbed = await fullReport.generatePrivateEmbed(caseObj?.getCaseThreadLink());
	// Send a notification to the report thread about the new report
	const reportThreadMessage = await reportThread.send({
		content: `${caseObj?.getCaseThreadLink() ? `Forwarded to [case thread](${caseObj.getCaseThreadLink()})\n` : ''} <@&${moderatorRoleId}> A new report has been submitted.`,
		embeds: [reportEmbed],
		components: generateReportModButtons(fullReport.getReportId()),
	});
	// Pin the report thread message to make it easily accessible for moderators
	await reportThreadMessage
		.pin()
		.catch((error) => logger.warn(`Could not pin Report #${fullReport.getReportId()} message: ${error}`));
	// Forward the report into the case thread if it exists
	if (caseObj?.getCaseThreadLink()) {
		// We store the full discord link to the channel thread, need to slice the URL to get the channel ID
		const caseThread = await globalThis.reportChannel.client.channels.fetch(
			caseObj.getCaseThreadLink().slice(caseObj.getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (caseThread) {
			await reportThreadMessage.forward(caseThread.id);
		}
	}

	try {
		const [warnings, cases] = await Promise.all([
			globalThis.databaseManager.getWarnings(fullReport.getSubjectId()),
			globalThis.databaseManager.getCasesBySubjectId(fullReport.getSubjectId()),
		]);
		subjectUser.setWarnings(warnings);
		subjectUser.setCases(cases);
		await reportThread.send({
			embeds: [subjectUser.generateUserSummaryEmbed()],
			components: generateUserSummaryButtons(subjectUser.getUserId()),
		});
	} catch (historyError) {
		logger.error(`Failed to add subject history to report ${fullReport.getReportId()} thread: ${historyError}`);
	}
}

module.exports = {
	createReportMessage,
};
