const { EmbedBuilder } = require('discord.js');
const { chunkTextPreserveNewlines } = require('../../util/UtilFunctions');
const { modmailUserId } = require('../../config.json');

function generateReportEmbed() {
	const reportEmbed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('Report User')
		.setDescription(
			`Use the button below to report a user to MLE Moderation. Please provide as much detail as possible in your report to help us address the issue effectively.\n
            For the "Who are you reporting?" field, you can enter the MLE Username, Discord ID, or MLE ID of the user you wish to report.\n
            After submitting the report form, you will have the opportunity to attach any relevant files or screenshots in the following steps.\n
			Note: For reports related to RL league play or competitive integrity, please submit the [CIC report form](https://bit.ly/CICReport) instead.
			For TM league play or competitive integrity, please message the staff mailbox <@${modmailUserId}>.`,
		)
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
		.setFooter({ text: 'Thank you for helping us keep the community safe!' })
		.setTimestamp();
	return reportEmbed;
}

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

function generateWarnConfirmationEmbed(
	dbUser,
	probationStatus,
	rulesBroken,
	violatingContent,
	pointsAdded,
	newPointsTotal,
	moderatorNotes,
	recommendedAction,
	caseId,
) {
	return new EmbedBuilder()
		.setColor('#ff761b')
		.setTitle(`${dbUser.getUserName()} | Warning Proposed`)
		.setFooter({ text: `ID: ${dbUser.getDiscordId()}` })
		.setTimestamp()
		.setThumbnail(dbUser.getDiscordAvatar())
		.addFields(
			{ name: 'User', value: `<@${dbUser.getDiscordId()}>`, inline: true },
			{ name: 'MLE ID', value: dbUser.getMleId() ?? 'N/A', inline: true },
			{ name: 'On Probation', value: String(probationStatus), inline: true },
			{ name: 'Rule(s) Broken', value: String(rulesBroken ?? 'None') },
			{ name: 'Violating Content', value: String(violatingContent ?? 'None') },
			{
				name: 'Points Added',
				value: String(pointsAdded === 1 ? '1 point' : `${pointsAdded} points`),
				inline: true,
			},
			{
				name: 'New Points Total',
				value: String(newPointsTotal === 1 ? '1 point' : `${newPointsTotal} points`),
				inline: true,
			},
			{
				name: 'Moderator Notes',
				value: String(moderatorNotes?.trim() === '' ? 'None' : moderatorNotes.trim()),
			},
			{
				name: 'Recommended Action',
				value: String(generateRecommendedActionDescription(recommendedAction)),
			},
			{ name: 'Case', value: caseId ? `#${caseId}` : 'None', inline: true },
		);
}

function generateRecommendedActionDescription(action) {
	if (action === 'ban') {
		return 'Ban the user';
	} else if (action.startsWith('mute=') && action.includes(';suspension=')) {
		const [mutePart, suspensionPart] = action.split(';');
		const muteDays = mutePart.split('=')[1];
		const suspensionWeeks = suspensionPart.split('=')[1];
		return `Mute for ${muteDays} days and suspend for ${suspensionWeeks} week(s)`;
	} else if (action.startsWith('mute=')) {
		const muteDays = action.split('=')[1];
		return `Mute for ${muteDays} days`;
	} else if (action === 'warning') {
		return 'Issue a warning';
	} else {
		return 'No action recommended';
	}
}

// Warnings loaded via the database manager carry a full Case, so reporters come from it directly
function generateWarningHistoryEmbed(warning) {
	return warning.generatePrivateEmbed(warning.getCase()?.getReporterNames() ?? 'None');
}

function generateUserHistoryEmbed(user, reports, punishments) {
	return user.generateUserSummaryEmbed().addFields(
		{ name: 'Reports', value: reports.length > 0 ? `${reports.length} report(s) found` : 'No reports found' },
		{
			name: 'Punishments',
			value: punishments.length > 0 ? `${punishments.length} punishment(s) found` : 'No punishments found',
		},
	);
}

module.exports = {
	generateWarningHistoryEmbed,
	generateUserHistoryEmbed,
	generateReportEmbed,
	generateFailedUserReportEmbed,
	generateUserReportConfirmationEmbed,
	generateWarnConfirmationEmbed,
};
