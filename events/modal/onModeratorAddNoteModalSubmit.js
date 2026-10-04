const log4js = require('log4js');
const logger = log4js.getLogger('onModeratorAddNoteModalSubmit');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { refreshReportMessage } = require('../../util/message/ReportMessageFunctions');
const { refreshCaseMessage } = require('../../util/message/CaseMessageFunctions');

async function handleModeratorAddNoteModalSubmit(interaction) {
	const modalId = interaction.customId;

	await interaction.deferReply();

	const [, type, dbId] = modalId.split(':');
	logger.debug(`Handling moderator add note modal submit for type: ${type}, DB ID: ${dbId}`);
	if (type === 'report') {
		const report = await globalThis.databaseManager.getReportById(dbId);
		const note = interaction.fields.getTextInputValue('note').trim();
		report.addModeratorNote(`**(${interaction.user.tag})**: ${note}`);
		await globalThis.databaseManager.updateReport(dbId, { moderator_notes: report.getModeratorNotes() });
		await refreshReportMessage(report);
		await interaction.editReply({
			content: `${interaction.user.tag} added a note to ${type === 'case' ? 'Case' : 'Report'} #${dbId}.`,
		});
	} else if (type === 'case') {
		const _case = await globalThis.databaseManager.getCaseById(dbId);
		const note = interaction.fields.getTextInputValue('note').trim();
		_case.addModeratorNote(`**(${interaction.user.tag})**: ${note}`);
		await globalThis.databaseManager.updateCase(dbId, { moderator_notes: _case.getModeratorNotes() });
		await refreshCaseMessage(_case);
		await interaction.editReply({
			content: `${interaction.user.tag} added a note to Case #${dbId}.`,
		});
	} else if (type === 'warning') {
		const warning = await globalThis.databaseManager.getWarningById(dbId);
		const note = interaction.fields.getTextInputValue('note').trim();
		warning.addModeratorNote(`**(${interaction.user.tag})**: ${note}`);
		await globalThis.databaseManager.updateWarning(dbId, { moderator_notes: warning.getModeratorNotes() });
		await interaction.editReply({
			content: `${interaction.user.tag} added a note to Warning #${dbId}.`,
		});
	}
}

module.exports = {
	handleModeratorAddNoteModalSubmit,
};
