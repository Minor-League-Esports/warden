const log4js = require('log4js');
const logger = log4js.getLogger('onOverrideWarnModalSubmit');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { buildWarnUserModal } = require('../../util/builders/ModalFunctions');

async function handleOverrideWarnModalSubmit(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	const kase = await globalThis.databaseManager.getCaseById(dbId);
	const modal = buildWarnUserModal(kase.getSubjectId(), dbId);
	await interaction.showModal(modal);

	//     if (interaction.customId.startsWith('overrideWarnModal:')) {
	// 	const [, dbId, moderatorId, caseId] = interaction.customId.split(':');
	// 	const action = parseOverrideAction(interaction.fields.getTextInputValue('punishments'));
	// 	if (!action) {
	// 		await interaction.reply({
	// 			content: 'Use one or more actions separated by `;`: `mute=<days>`, `suspension=<weeks>`, or `ban`.',
	// 		});
	// 		return;
	// 	}

	// 	const proposalEmbed = interaction.message?.embeds[0];
	// 	if (!proposalEmbed) {
	// 		await interaction.reply({ content: 'Error: The original warning proposal could not be found.' });
	// 		return;
	// 	}

	// 	const fields = proposalEmbed.fields.map((field) =>
	// 		field.name === 'Recommended Action' ? { ...field, value: describeAction(action) } : field,
	// 	);
	// 	const overrideEmbed = EmbedBuilder.from(proposalEmbed).setFields(fields);
	// 	await interaction.update({
	// 		embeds: [overrideEmbed],
	// 		components: generateWarnConfirmationButtons(dbId, moderatorId, action, caseId),
	// 	});
	// 	return;
	// }
}

module.exports = {
	handleOverrideWarnModalSubmit,
};
