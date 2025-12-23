const log4js = require('log4js');
const logger = log4js.getLogger('onReportModalSubmit');
const { logLevel, modmailUserId } = require('../config.json');
logger.level = logLevel;

const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		const modalId = interaction.customId;

		if (modalId.startsWith('reportUserModal:')) {
			const [, dbId] = modalId.split(':');
			await interaction.deferReply();

			const subjectInput = interaction.fields.getTextInputValue('subject');
			const reason = interaction.fields.getTextInputValue('reason');
			const evidenceText = interaction.fields.getTextInputValue('evidence');

			try {
				const subject = await globalThis.userUtility.fetchDatabaseUserUnknownType(subjectInput);
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
	return new EmbedBuilder()
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
			{ name: 'Report Reason', value: String(reason ?? 'N/A') },
			{ name: 'Report Evidence', value: String(evidence?.trim() === '' ? 'None' : evidence.trim()) },
		);
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
