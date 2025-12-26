const log4js = require('log4js');
const logger = log4js.getLogger('onReportModalSubmit');
const { logLevel, modmailUserId } = require('../config.json');
logger.level = logLevel;

const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { chunkTextPreserveNewlines } = require('../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		const modalId = interaction.customId;

		if (modalId.startsWith('reportUserModal:')) {
			const [, dbId] = modalId.split(':');
			await interaction.deferReply();

			const subjectInput = interaction.fields.getTextInputValue('subject').trim();
			const reason = interaction.fields.getTextInputValue('reason').trim();
			let evidenceText = interaction.fields.getTextInputValue('evidence').trim();
			if (evidenceText.length === 0) evidenceText = 'N/A';

			try {
				const subject = await globalThis.userUtility.fetchDatabaseUser(subjectInput);
				const confirmationEmbed = generateUserReportConfirmationEmbed(subject, reason, evidenceText);
				const buttons = generateConfirmationButtons(subject.getUserId(), dbId);
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
	},
};

function generateFailedUserReportEmbed(subjectInput) {
	return new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('Report User | Error')
		.setDescription(
			`Could not find user "${subjectInput}". Please ensure you entered a valid MLE Username, Discord ID, or MLE ID.`,
		)
		.addFields({
			name: 'Finding Discord IDs',
			value:
				'Refer to <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID> for help finding Discord IDs.',
		})
		.addFields({
			name: 'Finding MLE IDs',
			value:
				'You can find the MLE ID of a player by finding one of their salary cards and looking at the "MLEID" field.',
		})
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
		.setFooter({ text: `Please try again or contact <@${modmailUserId}> for assistance.` })
		.setTimestamp();
}

function generateUserReportConfirmationEmbed(dbUser, reason, evidence) {
	const embed = new EmbedBuilder()
		.setColor('#ff761b')
		.setTitle(`${dbUser.getUserName()} | Report Confirmation`)
		.setFooter({ text: `ID: ${dbUser.getDiscordId()}` })
		.setTimestamp()
		.setThumbnail(dbUser.getDiscordAvatar())
		.setDescription(
			'Please confirm the details of your report. After submission, you will have the opportunity to attach any relevant files or screenshots.',
		)
		.addFields(
			{ name: 'User', value: `<@${dbUser.getDiscordId()}>`, inline: true },
			{ name: 'MLE ID', value: dbUser.getMleId() ?? 'N/A', inline: true },
		);

	// Report Reason (may be long)
	const reasonChunks = chunkTextPreserveNewlines(reason, 1024);
	for (let i = 0; i < reasonChunks.length; i++) {
		embed.addFields({ name: i === 0 ? 'Report Reason' : 'Report Reason (cont.)', value: reasonChunks[i] });
	}

	// Evidence (may be long)
	const evidenceChunks = chunkTextPreserveNewlines(evidence, 1024);
	for (let i = 0; i < evidenceChunks.length; i++) {
		embed.addFields({ name: i === 0 ? 'Evidence' : 'Evidence (cont.)', value: evidenceChunks[i] });
	}

	return embed;
}

function generateConfirmationButtons(subjectId, reporterId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmReportSubmit:${subjectId}:${reporterId}`)
		.setLabel('Confirm Report Submission')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelReportSubmit:${reporterId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}
