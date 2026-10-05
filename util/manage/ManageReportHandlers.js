const log4js = require('log4js');
const logger = log4js.getLogger('ManageReport');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { buildReportAddNoteModal, buildReportReplyModal } = require('../builders/ModalFunctions');
const { generateCloseReportConfirmationButtons } = require('../builders/ButtonFunctions');
const { filterByStatus, finishList } = require('./ManageUtil');
const { attachRecordToCase, detachRecordFromCase } = require('./ManageCaseHandlers');

async function fetchReport(interaction, reportId) {
	const report = await globalThis.databaseManager.getReportById(reportId);
	if (!report) await interaction.editReply({ content: `Could not find Report #${reportId}.` });
	return report;
}

async function details(interaction) {
	const reportId = interaction.options.getInteger('report_id');
	const report = await fetchReport(interaction, reportId);
	if (!report) return;

	await interaction.editReply({
		content: `Details for Report #${reportId}`,
		embeds: [await report.generatePrivateEmbed()],
	});
}

async function close(interaction) {
	const reportId = interaction.options.getInteger('report_id');
	const report = await fetchReport(interaction, reportId);
	if (!report) return;

	if (String(report.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Report #${reportId} is already closed.` });
		return;
	}

	await interaction.editReply({
		content: `Are you sure you want to close Report #${reportId}?`,
		components: generateCloseReportConfirmationButtons(reportId, interaction.user.id),
	});
}

async function list(interaction) {
	const statusFilter = interaction.options.getString('status') ?? 'open';
	const reports = filterByStatus(await globalThis.databaseManager.getAllReports(), statusFilter);
	reports.sort((a, b) => b.getReportId() - a.getReportId());

	if (reports.length === 0) {
		await interaction.editReply({
			content:
				statusFilter === 'all'
					? 'There have not been any reports submitted yet.'
					: `There are no ${statusFilter} reports.`,
		});
		return;
	}

	let text = statusFilter === 'all' ? 'All submitted reports:\n' : `All ${statusFilter} reports:\n`;
	for (const report of reports) {
		const subjectName = report.getSubjectUser()?.getUserName() ?? 'Unknown';
		const reporterName = report.getReporter()?.getUserName() ?? 'Unknown';
		text += `- [Report #${report.getReportId()}](${report.getReportLink()}) - ${subjectName} (by ${reporterName}) - ${report.getStatus()}\n`;
	}
	await interaction.editReply({
		content: finishList(text, 'Use `/manage report details` with an ID to view more details about a specific report.'),
	});
}

// Not deferred: showModal must be the first response
async function note(interaction) {
	const reportId = interaction.options.getInteger('report_id');
	if (!(await globalThis.databaseManager.getReportById(reportId))) {
		await interaction.reply({ content: `Could not find report #${reportId}.`, flags: MessageFlags.Ephemeral });
		return;
	}
	await interaction.showModal(buildReportAddNoteModal(reportId));
}

// Not deferred: showModal must be the first response
async function reply(interaction) {
	const reportId = interaction.options.getInteger('report_id');
	if (!(await globalThis.databaseManager.getReportById(reportId))) {
		await interaction.reply({ content: `Could not find report #${reportId}.`, flags: MessageFlags.Ephemeral });
		return;
	}
	await interaction.showModal(buildReportReplyModal(reportId));
}

async function attach(interaction) {
	await attachRecordToCase(
		interaction,
		'report',
		interaction.options.getInteger('report_id'),
		interaction.options.getInteger('case_id'),
	);
}

async function detach(interaction) {
	await detachRecordFromCase(interaction, 'report', interaction.options.getInteger('report_id'));
}

module.exports = {
	handlers: { details, close, list, note, reply, attach, detach },
};
