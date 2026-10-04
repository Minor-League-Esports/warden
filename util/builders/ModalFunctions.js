const { ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle } = require('discord.js');

function buildReportUserModal(dbId) {
	const modal = new ModalBuilder().setCustomId(`reportUserModal:${dbId}`).setTitle('Report User');

	const subjectInput = new TextInputBuilder()
		.setCustomId('subject')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('TheGamingBear')
		.setRequired(true);
	const subjectLabel = new LabelBuilder().setLabel('Who are you reporting?').setTextInputComponent(subjectInput);

	const reasonInput = new TextInputBuilder()
		.setCustomId('reason')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('What rule(s) did they break and why are you reporting them?')
		.setRequired(true);
	const reasonInputLabel = new LabelBuilder().setLabel('Reason for Report').setTextInputComponent(reasonInput);

	const evidenceInput = new TextInputBuilder()
		.setCustomId('evidence')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Paste links here if available. You can attach files afterwards with `/report evidence`.')
		.setRequired(false);
	const evidenceInputLabel = new LabelBuilder().setLabel('Evidence (if any)').setTextInputComponent(evidenceInput);

	modal.addLabelComponents(subjectLabel, reasonInputLabel, evidenceInputLabel);

	return modal;
}

function buildReportUpdateModal(dbId) {
	const modal = new ModalBuilder().setCustomId(`reportUpdateModal:${dbId}`).setTitle(`Update Report #${dbId}`);

	const updateInput = new TextInputBuilder()
		.setCustomId('update')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Please provide any additional details or updates regarding your report.')
		.setRequired(true);
	const updateInputLabel = new LabelBuilder().setLabel('Update for Report').setTextInputComponent(updateInput);

	modal.addLabelComponents(updateInputLabel);

	return modal;
}

function buildReportReplyModal(dbId) {
	const modal = new ModalBuilder().setCustomId(`reportReplyModal:${dbId}`).setTitle('Reply to Reporter');

	const replyInput = new TextInputBuilder()
		.setCustomId('reply')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Provide your reply to the report here.')
		.setRequired(true);
	const replyInputLabel = new LabelBuilder().setLabel('Reply').setTextInputComponent(replyInput);

	modal.addLabelComponents(replyInputLabel);

	return modal;
}

function buildCaseAddNoteModal(dbId) {
	const modal = new ModalBuilder().setCustomId(`addModeratorNoteModal:case:${dbId}`).setTitle('Add Moderator Note');

	const noteInput = new TextInputBuilder()
		.setCustomId('note')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Provide your note regarding this case.')
		.setRequired(true);
	const noteInputLabel = new LabelBuilder().setLabel('Moderator Note').setTextInputComponent(noteInput);

	modal.addLabelComponents(noteInputLabel);

	return modal;
}

function buildReportAddNoteModal(dbId) {
	const modal = new ModalBuilder().setCustomId(`addModeratorNoteModal:report:${dbId}`).setTitle('Add Moderator Note');

	const noteInput = new TextInputBuilder()
		.setCustomId('note')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Provide your note regarding this report.')
		.setRequired(true);
	const noteInputLabel = new LabelBuilder().setLabel('Moderator Note').setTextInputComponent(noteInput);

	modal.addLabelComponents(noteInputLabel);

	return modal;
}

function buildWarningAddNoteModal(dbId) {
	const modal = new ModalBuilder().setCustomId(`addModeratorNoteModal:warning:${dbId}`).setTitle('Add Moderator Note');

	const noteInput = new TextInputBuilder()
		.setCustomId('note')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Provide your note regarding this warning.')
		.setRequired(true);
	const noteInputLabel = new LabelBuilder().setLabel('Moderator Note').setTextInputComponent(noteInput);

	modal.addLabelComponents(noteInputLabel);

	return modal;
}

/**
 * Builds the "Issue Warning to User" modal, shared by the /warn flow and the case "Create Warning" button.
 *
 * @param {String} customId
 * @returns {import('discord.js').ModalBuilder}
 */
function buildWarnUserModal(subjectId, caseId = null) {
	const modal = new ModalBuilder()
		.setCustomId(`warnUserModal:${subjectId}:${caseId ?? ''}`)
		.setTitle('Issue Warning to User');

	const rulesBrokenInput = new TextInputBuilder()
		.setCustomId('rulesBroken')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('1.2(1) Mildly offensive language')
		.setRequired(true);
	const rulesBrokenInputLabel = new LabelBuilder().setLabel('Rule(s) Broken').setTextInputComponent(rulesBrokenInput);

	const violatingContentInput = new TextInputBuilder()
		.setCustomId('violatingContent')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Direct quote or description of the violating content (shown to user)')
		.setRequired(true);
	const violatingContentInputLabel = new LabelBuilder()
		.setLabel('Violating Content')
		.setTextInputComponent(violatingContentInput);

	const pointsAddedInput = new TextInputBuilder()
		.setCustomId('pointsAdded')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Number of points to add to user record')
		.setMinLength(1)
		.setMaxLength(2)
		.setRequired(true);
	const pointsAddedInputLabel = new LabelBuilder().setLabel('Points Added').setTextInputComponent(pointsAddedInput);

	const moderatorNotesInput = new TextInputBuilder()
		.setCustomId('moderatorNotes')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Additional notes from the moderator (not shown to user)')
		.setRequired(false);
	const moderatorNotesInputLabel = new LabelBuilder()
		.setLabel('Moderator Notes')
		.setTextInputComponent(moderatorNotesInput);

	modal.addLabelComponents(
		rulesBrokenInputLabel,
		violatingContentInputLabel,
		pointsAddedInputLabel,
		moderatorNotesInputLabel,
	);

	return modal;
}

function buildOverrideWarnModal(dbId, moderatorId, caseId = null) {
	const modal = new ModalBuilder()
		.setCustomId(`overrideWarnModal:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setTitle('Override Suggested Action');
	const punishmentsInput = new TextInputBuilder()
		.setCustomId('punishments')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('warning;mute=7;suspension=1')
		.setRequired(true);
	const punishmentsLabel = new LabelBuilder()
		.setLabel('Punishments, separated by semicolons')
		.setTextInputComponent(punishmentsInput);
	modal.addLabelComponents(punishmentsLabel);

	return modal;
}

module.exports = {
	buildReportUserModal,
	buildReportUpdateModal,
	buildReportReplyModal,
	buildCaseAddNoteModal,
	buildReportAddNoteModal,
	buildWarningAddNoteModal,
	buildWarnUserModal,
	buildOverrideWarnModal,
};
