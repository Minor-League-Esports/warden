const log4js = require('log4js');
const logger = log4js.getLogger('onConfirmReportSubmissionButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { generateReportUpdateButton } = require('../../../util/builders/ButtonFunctions');
const { createCaseMessage } = require('../../../util/message/CaseMessageFunctions');
const { createReportMessage } = require('../../../util/message/ReportMessageFunctions');

async function handleConfirmReportSubmissionButtonClick(interaction) {
	const buttonId = interaction.customId;

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
	globalThis.databaseManager
		.createReport(subjectId, reporterId, reason, evidence)
		.then(async (report) => {
			// Fetch the subject and reporter user objects from the database
			const subject = await globalThis.databaseManager.getUserByIdentifier(subjectId, 'db');
			const reporter = await globalThis.databaseManager.getUserByIdentifier(reporterId, 'db');

			// Check if there is already an open case with this subject
			const existingCases = await globalThis.databaseManager.getCasesBySubjectId(subject.getUserId());
			// Filter to only include open cases
			const openCases = existingCases.filter((c) => c.getStatus() === 'OPEN');
			// If there are no open cases, automatically create a new one
			if (openCases.length === 0) {
				// Creator should be the bot itself
				const botId = interaction.client.user.id;
				const creator = await globalThis.databaseManager.getUserByIdentifier(botId, 'discord');
				const newCase = await globalThis.databaseManager.createCase(creator.getUserId(), subject.getUserId());
				await globalThis.databaseManager.attachReportToCase(report.getReportId(), newCase.getCaseId());
				await createCaseMessage(newCase);
				await createReportMessage(report);
			} else {
				// If there is at least one open case, don't attach to a case at all
				await createReportMessage(report);
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
				const reporterDiscordUser = await interaction.client.users.fetch(reporter.getDiscordId());
				await reporterDiscordUser.send({
					content: `Your report #${report.getReportId()} has been submitted to MLE Moderation. Thank you for helping keep the community safe!`,
					embeds: [reportUserEmbed],
					components: generateReportUpdateButton(report.getReportId()),
				});
			} catch (dmError) {
				logger.warn(`Could not DM reporter for report ${report.getReportId()}: ${dmError}`);
			}
		})
		.catch(async (error) => {
			// Handle any errors that occur during the report creation process
			logger.error(`Error creating report in database: ${error}`);
			await interaction.editReply({ components: [] });
			await interaction.followUp({
				content: 'There was an error submitting your report. Please try again later.',
				flags: MessageFlags.Ephemeral,
			});
		});
}

module.exports = {
	handleConfirmReportSubmissionButtonClick,
};
