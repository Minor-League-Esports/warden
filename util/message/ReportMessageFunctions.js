const log4js = require('log4js');
const logger = log4js.getLogger('ReportMessageFunctions');
const { moderatorRoleId, logLevel } = require('../../config.json');
logger.level = logLevel;

const { generateCaseReportButtons, generateReportModButtons } = require('../builders/ButtonFunctions');

async function attachReportToCaseThread(reportObj, caseObj) {
	// Fetch the report
	const fullReport = await globalThis.databaseManager.getReportById(reportObj.getReportId());
	// Fetch the case thread
	const caseThread = await globalThis.reportChannel.client.channels.fetch(
		caseObj.getCaseThreadLink().slice(caseObj.getCaseThreadLink().lastIndexOf('/') + 1),
	);
	if (!caseThread) {
		logger.warn(`Failed to fetch case thread for link: ${caseObj.getCaseThreadLink()}`);
		throw new Error(`Failed to fetch case thread for link: ${caseObj.getCaseThreadLink()}`);
	}

	const reportEmbed = await fullReport.generatePrivateEmbed(caseObj?.getCaseThreadLink());
	const reportMessage = await caseThread.send({
		content: `<@&${moderatorRoleId}> A report has been attached to case #${caseObj.getCaseId()}.`,
		embeds: [reportEmbed],
		components: generateCaseReportButtons(fullReport.getReportId()),
	});
	await reportMessage.pin();
	// Update the report with the message link
	fullReport.setReportLink(reportMessage.url);
	await globalThis.databaseManager.updateReport(fullReport.getReportId(), {
		report_link: reportMessage.url,
	});
	// Update the case embed with the new report link
	const fullCase = await globalThis.databaseManager.getCaseById(caseObj.getCaseId());
	const caseMessage = await caseThread.messages.fetch(fullCase.getCaseLink().split('/').pop());
	if (caseMessage) {
		const caseEmbed = await fullCase.generatePrivateEmbed();
		await caseMessage.edit({ embeds: [caseEmbed] });
	}
}

/**
 * Re-renders a report's moderator-facing embed on its original message (e.g. after it's attached to a case).
 *
 * @param {Report} report
 */
async function refreshReportMessage(report) {
	if (!report.getReportLink()) return;
	try {
		// Fetch the case thread
		const caseThread = await globalThis.reportChannel.client.channels.fetch(
			report
				.getCase()
				.getCaseThreadLink()
				.slice(report.getCase().getCaseThreadLink().lastIndexOf('/') + 1),
		);
		const embed = await report.generatePrivateEmbed();
		const reportMessage = await caseThread.messages.fetch(report.getReportLink().split('/').pop());
		await reportMessage.edit({
			embeds: [embed],
			components: generateReportModButtons(report.getReportId(), {
				acknowledged: report.isAcknowledged(),
				closed: report.isClosed(),
			}),
		});
	} catch (error) {
		logger.warn(`Failed to refresh report message for report ${report.getReportId()}: ${error}`);
	}
}

/**
 * Marks a report as acknowledged and DMs the reporter to let them know moderators are on it.
 *
 * @param {import('discord.js').Client} client
 * @param {String} reportId
 * @returns {Promise<Report>} The updated Report
 */
async function acknowledgeReport(client, reportId) {
	const report = await globalThis.databaseManager.getReportById(reportId);
	if (!report) throw new Error(`Report with ID ${reportId} not found`);

	const timestamp = new Date().toISOString();
	await globalThis.databaseManager.updateReport(reportId, {
		acknowledge_timestamp: timestamp,
		status: 'ACKNOWLEDGED',
	});
	report.setAcknowledgeTimestamp(timestamp);
	report.setStatus('ACKNOWLEDGED');

	const reportEmbed = await report.generateUserEmbed();

	try {
		const reporter = await globalThis.databaseManager.getUserByIdentifier(report.getReporterId(), 'db');
		const reporterDiscordUser = await client.users.fetch(reporter.getDiscordId());
		await reporterDiscordUser.send({
			content: `A member of MLE Moderation has acknowledged your report #${report.getReportId()}. Our team will begin our reviewing the details provided.`,
			embeds: [reportEmbed],
		});
	} catch (dmError) {
		logger.warn(`Could not DM reporter for report ${reportId}: ${dmError}`);
	}
	await refreshReportMessage(report);

	return report;
}

async function closeReport(client, reportId) {
	const report = await globalThis.databaseManager.getReportById(reportId);
	if (!report) throw new Error(`Report with ID ${reportId} not found`);

	const timestamp = new Date().toISOString();
	await globalThis.databaseManager.updateReport(reportId, {
		close_timestamp: timestamp,
		status: 'CLOSED',
	});
	report.setCloseTimestamp(timestamp);
	report.setStatus('CLOSED');

	const reportEmbed = await report.generateUserEmbed();

	try {
		const reporter = await globalThis.databaseManager.getUserByIdentifier(report.getReporterId(), 'db');
		const reporterDiscordUser = await client.users.fetch(reporter.getDiscordId());
		await reporterDiscordUser.send({
			content: `MLE Moderation has reviewed your report #${report.getReportId()} and concluded its investigation. Thank you for helping us maintain a safe community.`,
			embeds: [reportEmbed],
		});
	} catch (dmError) {
		logger.warn(`Could not DM reporter for report ${reportId}: ${dmError}`);
	}

	await refreshReportMessage(report);

	return report;
}

module.exports = {
	attachReportToCaseThread,
	refreshReportMessage,
	acknowledgeReport,
	closeReport,
};
