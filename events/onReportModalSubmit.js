const log4js = require('log4js');
const logger = log4js.getLogger('onReportModalSubmit');
const { logLevel, modmailUserId, moderatorRoleId } = require('../config.json');
logger.level = logLevel;

const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { chunkTextPreserveNewlines, notifyCaseThread, getCaseLinkById } = require('../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		const modalId = interaction.customId;

		if (modalId.startsWith('reportUserModal:')) {
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

		if (modalId.startsWith('updateReportModal:')) {
			if (interaction.inGuild()) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			} else {
				await interaction.deferReply();
			}

			const [, reportId] = modalId.split(':');

			// Pull fields
			const updatedReason = interaction.fields.getTextInputValue('reason').trim();
			const report = await globalThis.databaseManager.getReportById(reportId);
			const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

			// Check if the report exists and if the user is the reporter
			if (!report || report.getReporterId() !== user.getUserId()) {
				await interaction.editReply({
					content: `No report found with ID ${reportId}. Use the \`/report list\` command to see your submitted reports.`,
				});
				return;
			}

			// Add the updated reason details to the report
			report.addReasonDetails(updatedReason);

			// Get the report message URL and the updated moderator embed
			const reportMessageUrl = report.getReportLink();
			const updatedModEmbed = await report.generatePrivateEmbed(await getCaseLinkById(report.getCaseId()));

			try {
				if (!reportMessageUrl) throw new Error('No report message URL found');
				// Fetch the original report message from the report channel using the message ID extracted from the URL
				const reportMessage = await globalThis.reportChannel.messages.fetch(reportMessageUrl.split('/').pop());
				// Edit the original report message with the updated moderator embed
				await reportMessage.edit({ embeds: [updatedModEmbed] });
				// Get the thread associated with the report message
				const reportThread = reportMessage.hasThread ? reportMessage.thread : null;
				// Reply to the report thread if it exists, otherwise reply to the report message
				if (reportThread) {
					await reportThread.send(`This report has been updated with new information.`);
				} else {
					await reportMessage.reply(`This report has been updated with new information.`);
				}
			} catch (e) {
				logger.warn(`Failed to update report message for report ID ${reportId}`, e);
				// If updating the original report message fails, send a new message with the updated moderator embed
				const newMessage = await globalThis.reportChannel.send({
					content: `<@&${moderatorRoleId}>\nPlease note that the report #${reportId} submitted by <@${user.getDiscordId()}> has been updated, but I was unable to update the original report message. Here is the updated report:`,
					embeds: [updatedModEmbed],
				});
				// Update the report object with the new message URL in case the original message could not be updated
				report.setReportLink(newMessage.url);
				await globalThis.databaseManager.updateReport(report.getReportId(), { report_link: report.getReportLink() });
			}

			// Update the report in the DB with the new reason details
			await globalThis.databaseManager.updateReport(report.getReportId(), {
				report_reason: report.getReportReason(),
			});
			await notifyCaseThread(
				interaction.client,
				report.getCaseId(),
				`Report #${reportId} was updated with new information: ${report.getReportLink() ?? 'N/A'}`,
			);
			// Generate the updated user embed for the interaction reply
			const embed = await report.generateUserEmbed();
			await interaction.editReply({
				content: `Your report #${reportId} has been updated.`,
				embeds: [embed],
				components: generateReportUpdateButton(reportId),
			});
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

function generateReportUpdateButton(reportId) {
	const updateButton = new ButtonBuilder()
		.setCustomId(`reportUpdateButton:${reportId}`)
		.setLabel('Update Report')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(updateButton);
	return [actionRow];
}
