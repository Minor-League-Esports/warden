const log4js = require('log4js');
const logger = log4js.getLogger('ReportMessageFunctions');
const { moderatorRoleId, logLevel } = require('../../config.json');
logger.level = logLevel;

const { generateCaseReportButtons, generateReportModButtons } = require('../builders/ButtonFunctions');

async function attachReportToCaseThread(reportObj, caseObj) {
	// Fetch the report
	const fullReport = await globalThis.databaseManager.getReportById(reportObj.getReportId());
	// Fetch the case thread
	const caseThread = await globalThis.discordClient.channels.fetch(
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
		const caseEmbed = fullCase.generatePrivateEmbed();
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
		const caseThread = await globalThis.discordClient.channels.fetch(
			report
				.getCase()
				.getCaseThreadLink()
				.slice(report.getCase().getCaseThreadLink().lastIndexOf('/') + 1),
		);

		if (!caseThread) {
			logger.warn(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
			throw new Error(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
		}

		if (report.getReportLink()) {
			await caseThread.messages
				.fetch(report.getReportLink().split('/').pop())
				.then(async (message) => {
					const embed = await report.generatePrivateEmbed();
					await message.edit({
						embeds: [embed],
						components: generateReportModButtons(report.getReportId(), {
							acknowledged: report.isAcknowledged(),
							closed: report.isClosed(),
						}),
					});
				})
				.catch(async (error) => {
					// Error code for "unknown message"
					if (error.code === 10008) {
						logger.warn(`Failed to fetch report message for link: ${report.getReportLink()}`);
						await recreateReportMessage(report);
					} else {
						logger.error(`Failed to fetch report message for link: ${report.getReportLink()}: ${error}`);
						throw error;
					}
				});
		} else {
			await recreateReportMessage(report);
		}
	} catch (error) {
		logger.warn(`Failed to refresh report message for report ${report.getReportId()}: ${error}`);
	}
}

async function recreateReportMessage(report) {
	try {
		const caseThread = await globalThis.discordClient.channels.fetch(
			report
				.getCase()
				.getCaseThreadLink()
				.slice(report.getCase().getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (!caseThread) {
			logger.warn(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
			throw new Error(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
		}
		const embed = await report.generatePrivateEmbed();
		const newMessage = await caseThread.send({
			content: `Recreating report message for link: ${report.getReportLink()}.`,
			embeds: [embed],
			components: generateReportModButtons(report.getReportId(), {
				acknowledged: report.isAcknowledged(),
				closed: report.isClosed(),
			}),
		});
		report.setReportLink(newMessage.url);
		await globalThis.databaseManager.updateReport(report.getReportId(), {
			report_link: newMessage.url,
		});
		await newMessage.pin();
		return newMessage;
	} catch (error) {
		logger.error(`Failed to recreate report message for report ${report.getReportId()}: ${error}`);
	}
}

async function notifyReportUpdate(report, messageContent) {
	if (!report.getReportLink()) return;
	try {
		// Fetch the case thread
		const caseThread = await globalThis.discordClient.channels.fetch(
			report
				.getCase()
				.getCaseThreadLink()
				.slice(report.getCase().getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (!caseThread) {
			logger.warn(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
			throw new Error(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
		}
		if (report.getReportLink()) {
			await caseThread.messages
				.fetch(report.getReportLink().split('/').pop())
				.then(async (message) => {
					await message.reply({
						content: messageContent,
					});
				})
				.catch(async (error) => {
					// Error code for "unknown message"
					if (error.code === 10008) {
						logger.warn(`Failed to fetch report message for link: ${report.getReportLink()}`);
						const newReportMessage = await recreateReportMessage(report);
						await newReportMessage.reply({
							content: messageContent,
						});
					} else {
						logger.error(`Failed to fetch report message for link: ${report.getReportLink()}: ${error}`);
						throw error;
					}
				});
		} else {
			const newReportMessage = await recreateReportMessage(report);
			await newReportMessage.reply({
				content: messageContent,
			});
		}
	} catch (error) {
		logger.warn(`Failed to notify report update for report ${report.getReportId()}: ${error}`);
	}
}

async function attachEvidenceToReport(report, evidenceFiles) {
	if (!report.getReportLink()) return;
	try {
		// Fetch the case thread
		const caseThread = await globalThis.discordClient.channels.fetch(
			report
				.getCase()
				.getCaseThreadLink()
				.slice(report.getCase().getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (!caseThread) {
			logger.warn(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
			throw new Error(`Failed to fetch case thread for link: ${report.getCase().getCaseThreadLink()}`);
		}

		if (report.getReportLink()) {
			await caseThread.messages
				.fetch(report.getReportLink().split('/').pop())
				.then(async (message) => {
					const evidenceMessage = await message.reply({
						content: `Evidence files have been attached to report #${report.getReportId()}`,
						files: evidenceFiles,
					});
					report.addReportEvidence(evidenceMessage.url);
					// Update the report in the DB with the new evidence files
					await globalThis.databaseManager.updateReport(report.getReportId(), {
						report_evidence: report.getReportEvidence(),
					});
					await refreshReportMessage(report);
					return report;
				})
				.catch(async (error) => {
					// Error code for "unknown message"
					if (error.code === 10008) {
						logger.warn(`Failed to fetch report message for link: ${report.getReportLink()}`);
						const newReportMessage = await recreateReportMessage(report);
						await newReportMessage.reply({
							content: `Evidence files have been attached to report #${report.getReportId()}`,
							files: evidenceFiles,
						});
						report.addReportEvidence(evidenceMessage.url);
						// Update the report in the DB with the new evidence files
						await globalThis.databaseManager.updateReport(report.getReportId(), {
							report_evidence: report.getReportEvidence(),
						});
						await refreshReportMessage(report);
						return report;
					} else {
						logger.error(`Failed to fetch report message for link: ${report.getReportLink()}: ${error}`);
						throw error;
					}
				});
		} else {
			const newReportMessage = await recreateReportMessage(report);
			await newReportMessage.reply({
				content: `Evidence files have been attached to report #${report.getReportId()}`,
				files: evidenceFiles,
			});
			report.addReportEvidence(evidenceMessage.url);
			// Update the report in the DB with the new evidence files
			await globalThis.databaseManager.updateReport(report.getReportId(), {
				report_evidence: report.getReportEvidence(),
			});
			await refreshReportMessage(report);
			return report;
		}
	} catch (error) {
		logger.warn(`Failed to notify report update for report ${report.getReportId()}: ${error}`);
	}
}

/**
 * Marks a report as acknowledged and DMs the reporter to let them know moderators are on it.
 *
 * @param {String} reportId
 * @returns {Promise<Report>} The updated Report
 */
async function acknowledgeReport(reportId) {
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
		const reporterDiscordUser = await globalThis.discordClient.users.fetch(reporter.getDiscordId());
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

async function replyToReport(reportId, replyContent) {
	const report = await globalThis.databaseManager.getReportById(reportId);
	if (!report) throw new Error(`Report with ID ${reportId} not found`);

	report.addReasonDetails(`**(MLE Moderation)**: ${replyContent}`);
	await globalThis.databaseManager.updateReport(reportId, { report_reason: report.getReportReason() });

	const reportEmbed = await report.generateUserEmbed();

	try {
		const reporter = await globalThis.databaseManager.getUserByIdentifier(report.getReporterId(), 'db');
		const reporterDiscordUser = await globalThis.discordClient.users.fetch(reporter.getDiscordId());
		await reporterDiscordUser.send({
			content: `A member of MLE Moderation has replied to your report #${report.getReportId()}.\n\n**(MLE Moderation)**: ${replyContent}`,
			embeds: [reportEmbed],
		});
	} catch (dmError) {
		logger.warn(`Could not DM reporter for report ${reportId}: ${dmError}`);
	}

	await refreshReportMessage(report);

	return report;
}

async function closeReport(reportId) {
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
		const reporterDiscordUser = await globalThis.discordClient.users.fetch(reporter.getDiscordId());
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
	replyToReport,
	notifyReportUpdate,
	attachEvidenceToReport,
};
