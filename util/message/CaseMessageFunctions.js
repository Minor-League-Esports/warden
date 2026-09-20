const log4js = require('log4js');
const logger = log4js.getLogger('CaseMessageFunctions');
const { moderatorRoleId, logLevel } = require('../../config.json');
logger.level = logLevel;

const { ChannelType } = require('discord.js');
const { generateCaseButtons, generateUserSummaryButtons } = require('../builders/ButtonFunctions');

async function createCaseMessage(caseObj) {
	// Fetch the case
	let fullCase = await globalThis.databaseManager.getCaseById(caseObj.getCaseId());
	// Get the subject mention for the case message
	const subjectMention = fullCase.getSubjectUser() ? `<@${fullCase.getSubjectUser().getDiscordId()}>` : 'Unknown';
	// Create a private thread for the case discussion among moderators
	// We do this first to ensure that the discussion thread exists before posting the case message
	// This way we don't have to update the original case embed after creating the thread
	const caseThread = await globalThis.caseChannel.threads.create({
		name: `Case #${fullCase.getCaseId()} (${fullCase.getSubjectUser()?.getUserName() ?? 'Unknown'})`,
		type: ChannelType.PrivateThread,
	});
	// Update the case with the thread link
	fullCase = await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
		case_thread_link: caseThread.url,
	});
	// Generate the private embed for the case message
	const caseEmbed = fullCase.generatePrivateEmbed();
	// Send the case message to the case channel
	const caseMessage = await globalThis.caseChannel.send({
		content: `Case #${fullCase.getCaseId()} | ${subjectMention}`,
		embeds: [caseEmbed],
	});
	// Update the case with the message link
	fullCase = await globalThis.databaseManager.updateCase(fullCase.getCaseId(), {
		case_link: caseMessage.url,
	});
	// Send a notification to the case thread about the new case
	const caseThreadMessage = await caseThread.send({
		content: `<@&${moderatorRoleId}> A new case has been opened.`,
		embeds: [caseEmbed],
		components: [generateCaseButtons(fullCase.getCaseId())],
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
		const subject = fullCase.getSubjectUser();
		subject.setWarnings(warnings);
		subject.setCases(cases);
		await caseThread.send({
			embeds: [subject.generateUserSummaryEmbed()],
			components: [generateUserSummaryButtons(subject.getUserId())],
		});
	} catch (historyError) {
		logger.error(`Failed to add subject history to case ${fullCase.getCaseId()} thread: ${historyError}`);
	}
}

module.exports = {
	createCaseMessage,
};
