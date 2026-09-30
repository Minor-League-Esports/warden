const log4js = require('log4js');
const logger = log4js.getLogger('onReportUserModalSubmit');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const {
	generateUserReportConfirmationEmbed,
	generateFailedUserReportEmbed,
} = require('../../../util/builders/EmbedFunctions');
const { generateReportConfirmationButtons } = require('../../../util/builders/ButtonFunctions');

async function handleReportUserModalSubmit(interaction) {
	const modalId = interaction.customId;

	if (interaction.inGuild()) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	} else {
		await interaction.deferReply();
	}

	const [, dbId] = modalId.split(':');

	const subjectInput = interaction.fields.getTextInputValue('subject').trim();
	const reason = interaction.fields.getTextInputValue('reason').trim();
	let evidenceText = interaction.fields.getTextInputValue('evidence').trim();
	if (evidenceText.length === 0) evidenceText = 'N/A';

	try {
		const subject = await globalThis.userUtility.fetchDatabaseUser(subjectInput);
		const confirmationEmbed = generateUserReportConfirmationEmbed(subject, reason, evidenceText);
		const buttons = generateReportConfirmationButtons(subject.getUserId(), dbId);
		await interaction.editReply({
			embeds: [confirmationEmbed],
			components: buttons,
		});
	} catch (err) {
		logger.info(`Reported user not found: ${subjectInput}: ${err}`);
		const embed = generateFailedUserReportEmbed(subjectInput);
		await interaction.editReply({
			embeds: [embed],
		});
	}
}

module.exports = {
	handleReportUserModalSubmit,
};
