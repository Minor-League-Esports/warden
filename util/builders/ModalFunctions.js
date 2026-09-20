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

module.exports = {
	buildReportUserModal,
};
