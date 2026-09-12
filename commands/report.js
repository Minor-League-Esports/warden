const log4js = require('log4js');
const logger = log4js.getLogger('ReportCommand');
const { logLevel, modmailUserId, moderatorRoleId } = require('../config.json');
logger.level = logLevel;

const {
	SlashCommandBuilder,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	EmbedBuilder,
} = require('discord.js');
const { notifyCaseThread, getCaseLinkForReport } = require('../util/UtilFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('report')
		.setDescription('Make a report to MLE Moderation')
		.addSubcommand((subcommand) => subcommand.setName('submit').setDescription('Report a user to MLE Moderation'))
		.addSubcommand((subcommand) =>
			subcommand
				.setName('evidence')
				.setDescription('Attach evidence to an existing report')
				.addIntegerOption((option) =>
					option
						.setName('report_id')
						.setDescription('The ID of the report you want to attach evidence to')
						.setRequired(true),
				)
				.addAttachmentOption((option) =>
					option.setName('evidence_file').setDescription('The evidence file to attach to the report').setRequired(true),
				)
				.addAttachmentOption((option) =>
					option.setName('evidence_file_2').setDescription('Second evidence file to attach to the report'),
				)
				.addAttachmentOption((option) =>
					option.setName('evidence_file_3').setDescription('Third evidence file to attach to the report'),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('status')
				.setDescription('View the status of an existing report')
				.addIntegerOption((option) =>
					option.setName('report_id').setDescription('The ID of the report you want to view').setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('list')
				.setDescription('List all your submitted reports')
				.addStringOption((option) =>
					option
						.setName('status')
						.setDescription('Filter reports by status')
						.addChoices(
							{ name: 'All', value: 'all' },
							{ name: 'Open', value: 'open' },
							{ name: 'Closed', value: 'closed' },
						),
				),
		),
	async execute(interaction) {
		// Defer the reply to give more time for processing
		// Ephemeral if in guild, public if in DMs
		if (interaction.inGuild()) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		} else {
			await interaction.deferReply();
		}

		const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'submit') {
			try {
				const reportEmbed = generateReportEmbed();
				const buttons = generateReportButtons(user.getUserId());
				await interaction.editReply({
					content: 'Read the information below and click the button to report a user.',
					embeds: [reportEmbed],
					components: buttons,
				});
			} catch (error) {
				logger.error(`Error executing report command: ${error}`);
				await interaction.editReply({
					content: `Something went wrong, try again. Message <@${modmailUserId}> if the issue persists.`,
				});
				return;
			}
		} else if (subcommand === 'status') {
			const reportId = interaction.options.getInteger('report_id');
			const report = await globalThis.databaseManager.getReportById(reportId);
			if (!report || report.getReporterId() !== user.getUserId()) {
				await interaction.editReply({
					content: `No report found with ID ${reportId}. Use the \`/report list\` command to see your submitted reports.`,
				});
				return;
			}
			const embed = await report.generateUserEmbed();
			await interaction.editReply({
				content: `Here is the status of your report #${reportId}`,
				embeds: [embed],
				components: generateReportUpdateButton(reportId),
			});
		} else if (subcommand === 'list') {
			const allReports = await globalThis.databaseManager.getReportsByUserId(user.getUserId(), 'reporter');
			const statusFilter = interaction.options.getString('status') ?? 'all';
			let reports = allReports;
			if (statusFilter === 'open') {
				reports = allReports.filter((report) => report.getStatus().toLowerCase() !== 'closed');
			} else if (statusFilter === 'closed') {
				reports = allReports.filter((report) => report.getStatus().toLowerCase() === 'closed');
			}

			if (reports.length === 0) {
				if (statusFilter === 'all') {
					await interaction.editReply({
						content: 'You have not submitted any reports yet.',
					});
				} else {
					await interaction.editReply({
						content: `You have no ${statusFilter} reports.`,
					});
				}
				return;
			}

			let reportList;
			if (statusFilter === 'all') {
				reportList = 'Your submitted reports:\n';
			} else {
				reportList = `Your ${statusFilter} reports:\n`;
			}

			for (const report of reports) {
				const subject = await globalThis.databaseManager.getUserByIdentifier(report.getSubjectId(), 'db');
				reportList += `- Report #${report.getReportId()} against ${subject.getUserName()}, Status: ${report.getStatus()}\n`;
			}

			reportList += '\nUse the `/report status` command with a Report ID to view more details about a specific report.';

			if (reportList.length > 2000) {
				reportList = reportList.slice(0, 1990) + '\n... (truncated)';
			}
			await interaction.editReply({
				content: reportList,
			});
		} else if (subcommand === 'evidence') {
			// Gather submitted data
			const reportId = interaction.options.getInteger('report_id');
			const evidenceFile = interaction.options.getAttachment('evidence_file');
			if (evidenceFile.size > 10 * 1024 * 1024) {
				await interaction.editReply({
					content: 'The evidence file exceeds the 10MB size limit. Please upload a smaller file.',
				});
				return;
			}
			const files = [evidenceFile];
			const evidenceFile2 = interaction.options.getAttachment('evidence_file_2');
			if (evidenceFile2) {
				if (evidenceFile2.size > 10 * 1024 * 1024) {
					await interaction.editReply({
						content: 'The second evidence file exceeds the 10MB size limit. Please upload a smaller file.',
					});
					return;
				}
				files.push(evidenceFile2);
			}
			const evidenceFile3 = interaction.options.getAttachment('evidence_file_3');
			if (evidenceFile3) {
				if (evidenceFile3.size > 10 * 1024 * 1024) {
					await interaction.editReply({
						content: 'The third evidence file exceeds the 10MB size limit. Please upload a smaller file.',
					});
					return;
				}
				files.push(evidenceFile3);
			}

			// Get the current report from the DB
			const report = await globalThis.databaseManager.getReportById(reportId);
			if (!report || report.getReporterId() !== user.getUserId()) {
				await interaction.editReply({
					content: `No report found with ID ${reportId}. Use the /report list command to see your submitted reports.`,
				});
				return;
			}

			// Send the evidence files to the designated evidence channel
			const message = await globalThis.reportEvidenceChannel.send({
				content: `Evidence for Report ID ${reportId} submitted by ${user.getUserName()} (DB ID: ${user.getUserId()})`,
				files: files,
			});
			logger.info(`Evidence files uploaded: ${message.url}`);
			// Update the report object with the new evidence URL
			report.addReportEvidence(message.url);
			// Update the report in the DB with the new evidence files
			await globalThis.databaseManager.updateReport(report.getReportId(), {
				report_evidence: report.getReportEvidence(),
			});
			await notifyCaseThread(
				interaction.client,
				report.getCaseId(),
				`Report #${reportId} was updated with new evidence: ${report.getReportLink() ?? 'N/A'}`,
			);

			// Generate the updated report embeds for the user and moderators
			const reportMessageUrl = report.getReportLink();
			const embed = await report.generateUserEmbed();
			const updatedModEmbed = await report.generatePrivateEmbed(await getCaseLinkForReport(report));

			// Attempt to update the original report message in the report channel with the new evidence
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
					await reportThread.send(`This report has been updated with new evidence.`);
				} else {
					await reportMessage.reply(`This report has been updated with new evidence.`);
				}
				logger.info('Added evidence to report message for report ID ' + reportId);
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

			// Edit the interaction reply to show the updated report to the user
			await interaction.editReply({
				content: `Evidence has been successfully attached to report ID ${reportId}. Here is the updated report:`,
				embeds: [embed],
				components: generateReportUpdateButton(reportId),
			});
		} else {
			logger.error(`Unknown /report subcommand: ${subcommand}`);
			await interaction.editReply({
				content: 'Unknown command.',
			});
		}
	},
};

function generateReportEmbed() {
	const reportEmbed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('Report User')
		.setDescription(
			`Use the button below to report a user to MLE Moderation. Please provide as much detail as possible in your report to help us address the issue effectively.\n
            For the "Who are you reporting?" field, you can enter the MLE Username, Discord ID, or MLE ID of the user you wish to report.\n
            After submitting the report form, you will have the opportunity to attach any relevant files or screenshots in the following steps.`,
		)
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
		.setFooter({ text: 'Thank you for helping us keep the community safe!' })
		.setTimestamp();
	return reportEmbed;
}

function generateReportButtons(dbId) {
	const reportButton = new ButtonBuilder()
		.setCustomId(`userReportButton:${dbId}`)
		.setLabel('Report User')
		.setStyle(ButtonStyle.Success);
	const actionRow = new ActionRowBuilder().addComponents(reportButton);
	return [actionRow];
}

function generateReportUpdateButton(reportId) {
	const updateButton = new ButtonBuilder()
		.setCustomId(`reportUpdateButton:${reportId}`)
		.setLabel('Update Report')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(updateButton);
	return [actionRow];
}
