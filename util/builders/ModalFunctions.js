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

module.exports = {
	buildReportUserModal,
	buildReportUpdateModal,
	buildReportReplyModal,
	buildReportAddNoteModal,
};
