const log4js = require('log4js');
const logger = log4js.getLogger('CaseMessageFunctions');
const { moderatorRoleId, logLevel } = require('../../config.json');
logger.level = logLevel;

const { ChannelType } = require('discord.js');
const { generateCaseButtons, generateUserSummaryButtons } = require('../builders/ButtonFunctions');
const { refreshReportMessage, closeReport } = require('./ReportMessageFunctions');

async function createCaseMessage(caseObj) {
	// Fetch the case
	const fullCase = await globalThis.databaseManager.getCaseById(caseObj.getCaseId());
	// Capture the subject now; updateCase below returns a fresh object without joined user data
	const subjectUser = fullCase.getSubjectUser();
	// Get the subject mention for the case message
	const subjectMention = subjectUser ? `<@${subjectUser.getDiscordId()}>` : 'Unknown';
	// Create a private thread for the case discussion among moderators
	// We do this first to ensure that the discussion thread exists before posting the case message
	// This way we don't have to update the original case embed after creating the thread
	const caseThread = await globalThis.caseChannel.threads.create({
		name: `Case #${fullCase.getCaseId()} (${subjectUser?.getUserName() ?? 'Unknown'})`,
		type: ChannelType.PrivateThread,
	});
	// Update the case with the thread link
	fullCase.setCaseThreadLink(caseThread.url);
	await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
		case_thread_link: caseThread.url,
	});
	// Generate the private embed for the case message
	const summaryEmbed = await fullCase.generateSummaryEmbed();
	// Send the case message to the case channel
	const summaryMessage = await globalThis.caseChannel.send({
		content: `Case Created: Case #${fullCase.getCaseId()}`,
		embeds: [summaryEmbed],
	});

	// Send a notification to the case thread about the new case
	const fullEmbed = fullCase.generatePrivateEmbed();
	const caseThreadMessage = await caseThread.send({
		content: `<@&${moderatorRoleId}> A new case has been opened.\nCase #${fullCase.getCaseId()} | ${subjectMention} `,
		embeds: [fullEmbed],
		components: generateCaseButtons(fullCase.getCaseId()),
	});
	// Update the case with the message link
	fullCase.setCaseLink(caseThreadMessage.url);
	fullCase.setCaseSummaryLink(summaryMessage.url);
	await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
		case_link: caseThreadMessage.url,
		case_summary_link: summaryMessage.url,
	});
	// Pin the case thread message to make it easily accessible for moderators
	await caseThreadMessage
		.pin()
		.catch((error) => logger.warn(`Could not pin Case #${fullCase.getCaseId()} message: ${error}`));

	try {
		const [warnings, cases] = await Promise.all([
			globalThis.databaseManager.getWarnings(fullCase.getSubjectId()),
			globalThis.databaseManager.getCasesBySubjectId(fullCase.getSubjectId()),
		]);
		// Don't include the current case in the subject's case history
		const filteredCases = cases.filter((c) => c.getCaseId() !== fullCase.getCaseId());
		subjectUser.setWarnings(warnings);
		subjectUser.setCases(filteredCases);
		await caseThread.send({
			embeds: [subjectUser.generateUserSummaryEmbed()],
			components: generateUserSummaryButtons(subjectUser.getUserId(), fullCase.getCaseId()),
		});
	} catch (historyError) {
		logger.error(`Failed to add subject history to case ${fullCase.getCaseId()} thread: ${historyError}`);
	}
}

/**
 * Re-renders a report's moderator-facing embed on its original message (e.g. after it's attached to a case).
 *
 * @param {Report} report
 */
async function refreshCaseMessage(fullCase) {
	if (!fullCase.getCaseThreadLink()) return;
	try {
		// Fetch the case thread
		const caseThread = await globalThis.discordClient.channels.fetch(
			fullCase.getCaseThreadLink().slice(fullCase.getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (!caseThread) {
			logger.error(`Failed to fetch case thread for link: ${fullCase.getCaseThreadLink()}`);
			throw new Error(`Failed to fetch case thread for link: ${fullCase.getCaseThreadLink()}`);
		}

		if (fullCase.getCaseLink()) {
			await caseThread.messages
				.fetch(fullCase.getCaseLink().split('/').pop())
				.then(async (caseThreadMessage) => {
					const embed = fullCase.generatePrivateEmbed();
					await caseThreadMessage.edit({
						embeds: [embed],
						components: generateCaseButtons(fullCase.getCaseId(), {
							claimed: fullCase.isClaimed(),
							closed: fullCase.isClosed(),
						}),
					});
				})
				.catch(async (error) => {
					// Error code for "unknown message"
					if (error.code === 10008) {
						logger.warn(`Failed to fetch case message for link: ${fullCase.getCaseLink()}`);
						await recreateCaseMessage(fullCase);
					} else {
						logger.error(`Failed to fetch case message for link: ${fullCase.getCaseLink()}: ${error}`);
						throw error;
					}
				});
		} else {
			await recreateCaseMessage(fullCase);
		}

		if (fullCase.getCaseSummaryLink()) {
			await globalThis.caseChannel.messages
				.fetch(fullCase.getCaseSummaryLink().split('/').pop())
				.then(async (summaryMessage) => {
					const summaryEmbed = await fullCase.generateSummaryEmbed();
					await summaryMessage.edit({
						embeds: [summaryEmbed],
					});
				})
				.catch(async (error) => {
					if (error.code === 10008) {
						logger.warn(`Failed to fetch case summary message for link: ${fullCase.getCaseSummaryLink()}`);
						await recreateCaseSummary(fullCase);
					} else {
						logger.error(
							`Failed to fetch or update case summary message for link: ${fullCase.getCaseSummaryLink()}: ${error}`,
						);
					}
				});
		} else {
			await recreateCaseSummary(fullCase);
		}
	} catch (error) {
		logger.warn(`Failed to refresh case message for case ${fullCase.getCaseId()}: ${error}`);
		throw error;
	}
}

async function recreateCaseMessage(fullCase) {
	try {
		const caseThread = await globalThis.discordClient.channels.fetch(
			fullCase.getCaseThreadLink().slice(fullCase.getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (!caseThread) {
			logger.warn(`Failed to fetch case thread for link: ${fullCase.getCaseThreadLink()}`);
			throw new Error(`Failed to fetch case thread for link: ${fullCase.getCaseThreadLink()}`);
		}
		const embed = fullCase.generatePrivateEmbed();
		const newMessage = await caseThread.send({
			content: `Recreating case thread message for link: ${fullCase.getCaseThreadLink()}.`,
			embeds: [embed],
			components: generateCaseButtons(fullCase.getCaseId(), {
				claimed: fullCase.isClaimed(),
				closed: fullCase.isClosed(),
			}),
		});
		fullCase.setCaseLink(newMessage.url);
		await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
			case_link: newMessage.url,
		});
		await newMessage.pin();
		return fullCase;
	} catch (error) {
		logger.error(`Failed to recreate case thread message for case ${fullCase.getCaseId()}: ${error}`);
		throw error;
	}
}

async function recreateCaseSummary(fullCase) {
	try {
		const summaryEmbed = await fullCase.generateSummaryEmbed();
		const newSummaryMessage = await globalThis.caseChannel.send({
			content: `Recreating case summary message for link: ${fullCase.getCaseSummaryLink()}.`,
			embeds: [summaryEmbed],
		});

		fullCase.setCaseSummaryLink(newSummaryMessage.url);
		await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
			case_summary_link: newSummaryMessage.url,
		});
		return fullCase;
	} catch (error) {
		logger.error(`Failed to recreate case summary message for case ${fullCase.getCaseId()}: ${error}`);
		throw error;
	}
}

async function assignCase(fullCase, moderator) {
	try {
		await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
			moderator_id: moderator.getUserId(),
		});
		fullCase.setModeratorId(moderator.getUserId());
		fullCase.setModerator(moderator);
		await refreshCaseMessage(fullCase);
		for (const report of fullCase.getReports()) {
			await globalThis.databaseManager.updateReport(report.getReportId(), {
				moderator_id: moderator.getUserId(),
			});
			report.setModeratorId(moderator.getUserId());
			report.setModerator(moderator);
			await refreshReportMessage(report);
		}
		return fullCase;
	} catch (error) {
		logger.warn(`Failed to assign moderator ${moderator.getUserId()} to case ${fullCase.getCaseId()}: ${error}`);
		throw error;
	}
}

async function closeCase(fullCase) {
	try {
		const timestamp = new Date().toISOString();
		await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
			status: 'CLOSED',
			closed_at: timestamp,
		});
		fullCase.setStatus('CLOSED');
		fullCase.setClosedAt(timestamp);

		for (const report of fullCase.getReports()) {
			await closeReport(report.getReportId());
		}

		await refreshCaseMessage(fullCase);
		return fullCase;
	} catch (error) {
		logger.error(`Failed to close case ${fullCase.getCaseId()}: ${error}`);
		throw error;
	}
}

/**
 * Closes the thread associated with the given case.
 * This is separate from closeCase because we reply to the interaction after closing the case.
 * If we close the thread first, the interaction reply would just re-open the thread.
 *
 * @param {*} fullCase The full case object containing information about the case and its associated thread.
 */
async function closeCaseThread(fullCase) {
	try {
		const caseThread = await globalThis.discordClient.channels.fetch(
			fullCase.getCaseThreadLink().slice(fullCase.getCaseThreadLink().lastIndexOf('/') + 1),
		);
		if (caseThread) {
			await caseThread.send({
				content: `The case has been closed.`,
			});
			// Rename the thread to prefix with "(C)" for closed
			await caseThread.setName(`(C) ${caseThread.name}`);
			await caseThread.setArchived(true);
		}
	} catch (error) {
		logger.error(`Failed to close case thread for case ${fullCase.getCaseId()}: ${error}`);
		throw error;
	}
}

module.exports = {
	createCaseMessage,
	refreshCaseMessage,
	assignCase,
	closeCase,
	closeCaseThread,
};
