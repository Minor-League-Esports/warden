const log4js = require('log4js');
const logger = log4js.getLogger('onConfirmReportSubmissionButtonClick');
const { logLevel, modmailUserId } = require('../../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { generateReportUpdateButton } = require('../../../../util/builders/ButtonFunctions');
const { createCaseMessage } = require('../../../../util/message/CaseMessageFunctions');
const { attachReportToCaseThread } = require('../../../../util/message/ReportMessageFunctions');

async function handleConfirmReportSubmissionButtonClick(interaction) {
	const buttonId = interaction.customId;
	logger.debug(`Confirm report submission button clicked with ID: ${buttonId}`);

	const [, subjectId, reporterId] = buttonId.split(':');
	const embed = interaction.message.embeds[0];

	// Ensure the interaction message contains an embed with the report details
	if (!embed) {
		logger.warn('No embed found in the interaction message during report confirmation.');
		await interaction.reply({
			content: 'There was an error with the report submission. Please try again later.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	// Extract the reason and evidence fields from the embed for validation
	const reasonFields = embed.fields.filter((field) => field.name.startsWith('Report Reason'));
	const evidenceFields = embed.fields.filter((field) => field.name.startsWith('Evidence'));

	// Validate that both reason and evidence fields are present
	if (!(reasonFields.length > 0 && evidenceFields.length > 0)) {
		logger.warn('Required fields missing in the embed during report confirmation.');
		await interaction.reply({
			content: 'There was an error with the report submission. Please try again later.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	// Extract and validate the reason field
	const reason = reasonFields
		.map((field) => field.value)
		.join('\n')
		.trim();
	if (reason.length === 0) {
		logger.warn('Empty report reason provided during report confirmation.');
		await interaction.reply({
			content: 'The report reason cannot be empty. Please try again.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	// Extract and validate the evidence field
	const evidence = evidenceFields
		.map((field) => field.value)
		.join('\n')
		.trim();
	if (evidence.length === 0) {
		logger.warn('Empty report evidence provided during report confirmation.');
		await interaction.reply({
			content: 'The report evidence cannot be empty. Please try again.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	// Defer the interaction update to acknowledge the button click before processing the report submission
	await interaction.deferUpdate();

	// Create the report in the database with the extracted reason and evidence fields
	try {
		const report = await globalThis.databaseManager.createReport(subjectId, reporterId, reason, evidence);
		// Fetch the subject and reporter user objects from the database
		logger.debug(
			`Created report with ID: ${report.getReportId()} for subject ID: ${subjectId} by reporter ID: ${reporterId}`,
		);
		// Check if there is already an open case with this subject
		const existingCases = await globalThis.databaseManager.getCasesBySubjectId(subjectId);
		logger.debug(`Existing cases for subject ID: ${subjectId}: ${existingCases.map((c) => c.getCaseId()).join(', ')}`);
		// Filter to only include open cases
		const openCases = existingCases.filter((c) => c.getStatus() === 'OPEN');
		// If there are no open cases, automatically create a new one
		if (openCases.length === 0) {
			logger.debug(`No open cases found for subject ID: ${subjectId}. Creating a new case.`);
			// Creator should be the bot itself
			const botId = interaction.client.user.id;
			const creator = await globalThis.userUtility.fetchDatabaseUser(botId);
			logger.debug(`Creating new case for subject ID: ${subjectId} by creator ID: ${creator.getUserId()}`);
			const newCase = await globalThis.databaseManager.createCase(creator.getUserId(), subjectId);
			await globalThis.databaseManager.attachReportToCase(report.getReportId(), newCase.getCaseId());
			await createCaseMessage(newCase);
			// Get the updated case
			const updatedCase = await globalThis.databaseManager.getCaseById(newCase.getCaseId());
			logger.debug(`Updated case retrieved`);
			logger.debug(updatedCase);
			await attachReportToCaseThread(report, updatedCase);
		} else {
			// If there is at least one open case, attach to the first open case
			await globalThis.databaseManager.attachReportToCase(report.getReportId(), openCases[0].getCaseId());
			// Get the updated case
			const updatedCase = await globalThis.databaseManager.getCaseById(openCases[0].getCaseId());
			logger.debug(`Updated case retrieved`);
			logger.debug(updatedCase);
			await attachReportToCaseThread(report, updatedCase);
		}

		// Generate the user-facing embed for the report and update the interaction reply
		const reportUserEmbed = await report.generateUserEmbed();
		await interaction.editReply({ components: [] });
		await interaction.followUp({
			content: `Your report #${report.getReportId()} has been submitted to MLE Moderation. Thank you for helping keep the community safe!`,
			embeds: [reportUserEmbed],
			components: generateReportUpdateButton(report.getReportId()),
			flags: MessageFlags.Ephemeral,
		});
		// Also DM the user with the same information
		try {
			const reporter = await globalThis.databaseManager.getUserByIdentifier(reporterId, 'db');
			const reporterDiscordUser = await interaction.client.users.fetch(reporter.getDiscordId());
			await reporterDiscordUser.send({
				content: `Your report #${report.getReportId()} has been submitted to MLE Moderation. Thank you for helping keep the community safe!`,
				embeds: [reportUserEmbed],
				components: generateReportUpdateButton(report.getReportId()),
			});
		} catch (dmError) {
			logger.warn(`Could not DM reporter for report ${report.getReportId()}: ${dmError}`);
		}
	} catch (error) {
		// Handle any errors that occur during the report creation process
		logger.error(`Error creating report in database: ${error}`);
		await interaction.followUp({
			content: `There was an error submitting your report. Please try again later or contact <@&${modmailUserId}>.`,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
}

module.exports = {
	handleConfirmReportSubmissionButtonClick,
};
