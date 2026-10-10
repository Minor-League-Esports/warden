const log4js = require('log4js');
const logger = log4js.getLogger('onReportUserModalSubmit');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const {
	generateUserReportConfirmationEmbed,
	generateFailedUserReportEmbed,
} = require('../../../util/builders/EmbedFunctions');
const { generateReportConfirmationButtons, generateUnmatchedReportConfirmationButtons } = require('../../../util/builders/ButtonFunctions');
const User = require('../../../util/entity/User');

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
		let subject = null;
		try {
			subject = await globalThis.userUtility.fetchDatabaseUser(subjectInput);
		} catch (lookupErr) {
			logger.info(`Reported user not found: ${subjectInput}: ${lookupErr}`);
		}

		if (subject) {
			await interaction.editReply({
				embeds: [generateUserReportConfirmationEmbed(subject, reason, evidenceText)],
				components: generateReportConfirmationButtons(subject.getUserId(), dbId),
			});
			return;
		}

		// Nothing is saved until the reporter confirms, so typos don't create users
		const unmatched = new User();
		unmatched.setUserName(subjectInput);
		unmatched.setAlternateIdentifier(subjectInput);
		await interaction.editReply({
			embeds: [generateUserReportConfirmationEmbed(unmatched, reason, evidenceText, subjectInput)],
			components: generateUnmatchedReportConfirmationButtons(dbId),
		});
	} catch (err) {
		logger.error(`Error handling report user modal submission for ${subjectInput}: ${err}`);
		const embed = generateFailedUserReportEmbed(subjectInput);
		await interaction.editReply({
			embeds: [embed],
		});
	}
}

module.exports = {
	handleReportUserModalSubmit,
};
