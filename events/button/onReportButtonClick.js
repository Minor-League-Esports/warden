const log4js = require('log4js');
const logger = log4js.getLogger('onReportButtonClick');
const { logLevel, moderatorRoleId } = require('../../config.json');
logger.level = logLevel;

const {
	Events,
	ModalBuilder,
	TextInputBuilder,
	LabelBuilder,
	TextInputStyle,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { buildModeratorNoteModal } = require('../../util/UtilFunctions');
const { generateUserSummaryButtons } = require('../../util/builders/ButtonFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('confirmReportSubmit:')) {
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
					// Generate the private embed for the report and send it to the report channel
					const reportModEmbed = await report.generatePrivateEmbed();
					// Fetch the subject and reporter user objects from the database
					const subject = await globalThis.databaseManager.getUserByIdentifier(subjectId, 'db');
					const reporter = await globalThis.databaseManager.getUserByIdentifier(reporterId, 'db');

					// Generate buttons "Create new case", "Add to case", and "Acknowledge Report"
					const actionRow = generateReportModButtons(report.getReportId());

					// Send the report message to the report channel with the moderator embed
					const reportMessage = await globalThis.reportChannel.send({
						content: `Report #${report.getReportId()} submitted by ${reporter.getUserName()}`,
						embeds: [reportModEmbed],
						components: actionRow,
					});
					// Create a thread for the report message
					const reportThread = await reportMessage.startThread({
						name: `Report #${report.getReportId()} (${subject.getUserName()})`,
					});
					// Ping the moderators in the report thread
					await reportThread.send(`<@&${moderatorRoleId}> A new report has been submitted.`);
					try {
						const [warnings, cases] = await Promise.all([
							globalThis.databaseManager.getWarnings(subject.getUserId()),
							globalThis.databaseManager.getCasesBySubjectId(subject.getUserId()),
						]);
						subject.setWarnings(warnings);
						subject.setCases(cases);
						await reportThread.send({
							embeds: [subject.generateUserSummaryEmbed()],
							components: generateUserSummaryButtons(subject.getUserId()),
						});
					} catch (historyError) {
						logger.error(`Failed to add subject history to report ${report.getReportId()} thread: ${historyError}`);
					}
					// Set the report link in the report object and update it in the database
					report.setReportLink(reportMessage.url);
					await globalThis.databaseManager.updateReport(report.getReportId(), { report_link: report.getReportLink() });

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

		if (buttonId.startsWith('reportUpdateButton:')) {
			const [, reportId] = buttonId.split(':');

			const modal = new ModalBuilder().setCustomId(`updateReportModal:${reportId}`).setTitle('Update Report');

			const reasonInput = new TextInputBuilder()
				.setCustomId('reason')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Please provide any additional details or updates regarding your report.')
				.setRequired(true);
			const reasonInputLabel = new LabelBuilder().setLabel('Reason for Report').setTextInputComponent(reasonInput);

			modal.addLabelComponents(reasonInputLabel);

			await interaction.showModal(modal);
		}

		if (buttonId.startsWith('reportAddNoteButton:')) {
			const [, reportId] = buttonId.split(':');
			try {
				await globalThis.databaseManager.getReportById(reportId);
				await interaction.showModal(buildModeratorNoteModal(`addModeratorNoteModal:report:${reportId}`));
			} catch (error) {
				logger.error(`Error opening note modal for report ${reportId}: ${error}`);
				await interaction.reply({ content: `Could not find Report #${reportId}.`, flags: MessageFlags.Ephemeral });
			}
		}

		if (buttonId.startsWith('closeReportButton:')) {
			const [, reportId, userId, sourceMessageId] = buttonId.split(':');
			if (interaction.user.id !== userId) {
				await interaction.reply({
					content: 'Only the moderator who started this confirmation can use it.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await interaction.update({ content: `Closing Report #${reportId}...`, components: [] });
			await closeReport(interaction, reportId, sourceMessageId);
		}
	},
};

function generateReportUpdateButton(reportId) {
	const updateButton = new ButtonBuilder()
		.setCustomId(`reportUpdateButton:${reportId}`)
		.setLabel('Update Report')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(updateButton);
	return [actionRow];
}

function generateReportModButtons(reportId) {
	const createNewCaseButton = new ButtonBuilder()
		.setCustomId(`createNewCaseButton:${reportId}`)
		.setLabel('Create New Case')
		.setStyle(ButtonStyle.Success);
	const addToCaseButton = new ButtonBuilder()
		.setCustomId(`addToCaseButton:${reportId}`)
		.setLabel('Add to Case')
		.setStyle(ButtonStyle.Primary);
	const addNoteButton = new ButtonBuilder()
		.setCustomId(`reportAddNoteButton:${reportId}`)
		.setLabel('Add Note')
		.setStyle(ButtonStyle.Secondary);
	return [new ActionRowBuilder().addComponents(createNewCaseButton, addToCaseButton, addNoteButton)];
}

async function closeReport(interaction, reportId, sourceMessageId = null) {
	try {
		const { reports: closedReports } = await globalThis.databaseManager.closeReport(reportId);
		const updatedReport = await globalThis.databaseManager.getReportById(reportId);

		if (sourceMessageId) {
			const sourceMessage = await interaction.channel.messages.fetch(sourceMessageId);
			await sourceMessage.edit({
				components: [generateReportModButtons(reportId)],
			});
		}
		await notifyReporterOfClosedReport(interaction.client, updatedReport);
		await archiveThread(interaction.client, updatedReport.getReportLink(), `report ${reportId}`);

		await interaction.followUp({ content: `Report #${reportId} has been closed.` });
	} catch (error) {
		logger.error(`Error closing report ${reportId}: ${error}`);
		await interaction.followUp({ content: 'Error: Failed to close report.' });
	}
}
