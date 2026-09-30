const log4js = require('log4js');
const logger = log4js.getLogger('ReportCommand');
const { logLevel, modmailUserId } = require('../config.json');
logger.level = logLevel;

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { generateReportButtons, generateReportUpdateButton } = require('../util/builders/ButtonFunctions');
const { generateReportEmbed } = require('../util/builders/EmbedFunctions');
const { buildReportUpdateModal } = require('../util/builders/ModalFunctions');
const { attachEvidenceToReport } = require('../util/message/ReportMessageFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('report')
		.setDescription('Manage your reports to MLE Moderation')
		.addSubcommand((subcommand) => subcommand.setName('submit').setDescription('Report a user to MLE Moderation'))
		.addSubcommand((subcommand) =>
			subcommand
				.setName('update')
				.setDescription('Provide an update to an existing report')
				.addIntegerOption((option) =>
					option
						.setName('report_id')
						.setDescription('The ID of the report you want to provide an update for')
						.setRequired(true),
				),
		)
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
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'update') {
			// Gather submitted data
			const reportId = interaction.options.getInteger('report_id');
			const modal = buildReportUpdateModal(reportId);
			await interaction.showModal(modal);
			return;
		}

		// Defer the reply to give more time for processing
		// Ephemeral if in guild, public if in DMs
		if (interaction.inGuild()) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		} else {
			await interaction.deferReply();
		}

		const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

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

			const updatedReport = await attachEvidenceToReport(report, files);
			const updatedReportEmbed = await updatedReport.generateUserEmbed();
			// Edit the interaction reply to show the updated report to the user
			await interaction.editReply({
				content: `Evidence has been successfully attached to report ID ${reportId}. Here is the updated report:`,
				embeds: [updatedReportEmbed],
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
