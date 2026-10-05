const log4js = require('log4js');
const logger = log4js.getLogger('onReportUpdateModalSubmit');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { refreshReportMessage, notifyReportUpdate } = require('../../../util/message/ReportMessageFunctions');

async function handleReportUpdateModalSubmit(interaction) {
	const modalId = interaction.customId;

	if (interaction.inGuild()) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	} else {
		await interaction.deferReply();
	}

	const [, reportId] = modalId.split(':');

	// Pull fields
	const updatedReason = interaction.fields.getTextInputValue('update').trim();
	const report = await globalThis.databaseManager.getReportById(reportId);
	const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

	// Check if the report exists and if the user is the reporter
	if (!report || report.getReporterId() !== user.getUserId()) {
		await interaction.editReply({
			content: `No report found with ID ${reportId}. Use the \`/report list\` command to see your submitted reports.`,
		});
		return;
	}

	// Add the updated reason details to the report
	report.addReasonDetails(updatedReason);
	// Update the report in the DB with the new reason details
	await globalThis.databaseManager.updateReport(report.getReportId(), {
		report_reason: report.getReportReason(),
	});
	await refreshReportMessage(report);
	await notifyReportUpdate(report, `Report #${reportId} was updated with new information`);
	// Generate the updated user embed for the interaction reply
	const embed = await report.generateUserEmbed();
	await interaction.editReply({
		content: `Your report #${reportId} has been updated.`,
		embeds: [embed],
	});
}

module.exports = {
	handleReportUpdateModalSubmit,
};
