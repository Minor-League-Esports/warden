const log4js = require('log4js');
const logger = log4js.getLogger('onMessageCreate');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');
const { generateReportUpdateButton } = require('../util/builders/ButtonFunctions');
const { attachEvidenceToReport } = require('../util/message/ReportMessageFunctions');

module.exports = {
	name: Events.MessageCreate,
	async execute(interaction) {
		// Don't listen to messages from bots
		if (interaction.author.bot) return;
		// Only handle direct messages
		if (interaction.guildId) return;
		const user = await globalThis.userUtility.fetchDatabaseUser(interaction.author.id);
		const allReports = await globalThis.databaseManager.getReportsByUserId(user.getUserId(), 'reporter');
		const openReports = allReports.filter((report) => report.getStatus().toLowerCase() !== 'closed');

		if (!openReports.length) {
			logger.debug('No open reports found for user:', user.getUserId());
			await interaction.reply(
				'It looks like you may be trying to report a user. Use `/report submit` to create a new report.',
			);
		} else if (openReports.length === 1) {
			// One open report found
			const report = openReports[0];
			const reportId = report.getReportId();

			if (!interaction.attachments.size) {
				// No attachments found, prompt the user to attach evidence or update the report
				const embed = await report.generateUserEmbed();
				await interaction.reply({
					content: `I found one open report: #${reportId}. To provide an update, use the button below or \`/report update ${reportId}\`. To attach evidence, use \`/report evidence ${reportId}\` or send a message with the files attached.`,
					embeds: [embed],
					components: generateReportUpdateButton(reportId),
				});
			} else {
				logger.debug(interaction);
				const attachments = interaction.attachments;
				logger.debug('Attachments found:', attachments);
				// Check each attachment for size limits
				const files = [];
				for (const [, attachment] of attachments) {
					if (attachment.size > 10 * 1024 * 1024) {
						await interaction.reply({
							content: `The evidence file \`${attachment.name}\` exceeds the 10MB size limit. Please upload a smaller file.`,
						});
						continue;
					}
					files.push(attachment);
				}

				await attachEvidenceToReport(report, files);
				const updatedReport = await globalThis.databaseManager.getReportById(reportId);
				const updatedReportEmbed = await updatedReport.generateUserEmbed();
				// Edit the interaction reply to show the updated report to the user
				await interaction.reply({
					content: `Evidence has been successfully attached to report ID ${reportId}. Here is the updated report:`,
					embeds: [updatedReportEmbed],
					components: generateReportUpdateButton(reportId),
				});
			}
		} else {
			// Handle multiple open reports
			const reportList = openReports
				.map(
					(report) =>
						`#${report.getReportId()} (${report.getSubjectUser() ? report.getSubjectUser().getDiscordMention() : 'Unknown'})`,
				)
				.join('\n');
			await interaction.reply(
				`You have multiple open reports:\n${reportList}\nUse \`/report update <reportId>\` to update a specific report or \`/report evidence <reportId>\` to attach evidence. Use \`/report status <reportId>\` to view the status of a specific report.`,
			);
		}
	},
};
