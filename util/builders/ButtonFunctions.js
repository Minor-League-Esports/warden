const log4js = require('log4js');
const logger = log4js.getLogger('ButtonFunctions');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

function generateReportButtons(dbId) {
	const reportButton = new ButtonBuilder()
		.setCustomId(`openUserReportModalButton:${dbId}`)
		.setLabel('Report User')
		.setStyle(ButtonStyle.Success);
	return [new ActionRowBuilder().addComponents(reportButton)];
}

function generateReportUpdateButton(reportId) {
	const updateButton = new ButtonBuilder()
		.setCustomId(`reportUpdateButton:${reportId}`)
		.setLabel('Update Report')
		.setStyle(ButtonStyle.Primary);
	return [new ActionRowBuilder().addComponents(updateButton)];
}

function generateUserSummaryButtons(dbId, caseId = null) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`userSummaryWarnButton:${dbId}:${caseId ?? ''}`)
		.setLabel('Warn User')
		.setStyle(ButtonStyle.Success);
	const viewButton = new ButtonBuilder()
		.setCustomId(`userViewHistoryButton:${dbId}`)
		.setLabel('View History')
		.setStyle(ButtonStyle.Primary);
	return [new ActionRowBuilder().addComponents(confirmButton, viewButton)];
}

function generateCaseReportButtons(reportId, { acknowledged = false, closed = false } = {}) {
	const acknowledgeButton = new ButtonBuilder()
		.setCustomId(`reportAcknowledgeButton:${reportId}`)
		.setLabel(acknowledged ? 'Acknowledged' : 'Acknowledge')
		.setStyle(ButtonStyle.Success)
		.setDisabled(acknowledged);
	const addNoteButton = new ButtonBuilder()
		.setCustomId(`reportAddNoteButton:${reportId}`)
		.setLabel('Add Note')
		.setStyle(ButtonStyle.Secondary);
	const replyButton = new ButtonBuilder()
		.setCustomId(`reportReplyButton:${reportId}`)
		.setLabel('Reply')
		.setStyle(ButtonStyle.Primary);
	const closeButton = new ButtonBuilder()
		.setCustomId(`reportCloseButton:${reportId}`)
		.setLabel(closed ? 'Closed' : 'Close Report')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(closed);
	return [new ActionRowBuilder().addComponents(acknowledgeButton, addNoteButton, replyButton, closeButton)];
}

function generateReportModButtons(reportId, { acknowledged = false, closed = false } = {}) {
	const acknowledgeButton = new ButtonBuilder()
		.setCustomId(`reportAcknowledgeButton:${reportId}`)
		.setLabel(acknowledged ? 'Acknowledged' : 'Acknowledge')
		.setStyle(ButtonStyle.Success)
		.setDisabled(acknowledged);
	const addNoteButton = new ButtonBuilder()
		.setCustomId(`reportAddNoteButton:${reportId}`)
		.setLabel('Add Note')
		.setStyle(ButtonStyle.Secondary);
	const replyButton = new ButtonBuilder()
		.setCustomId(`reportReplyButton:${reportId}`)
		.setLabel('Reply')
		.setStyle(ButtonStyle.Primary);
	const closeButton = new ButtonBuilder()
		.setCustomId(`reportCloseButton:${reportId}`)
		.setLabel(closed ? 'Closed' : 'Close Report')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(closed);
	return [new ActionRowBuilder().addComponents(acknowledgeButton, addNoteButton, replyButton, closeButton)];
}

function generateCaseButtons(caseId, { claimed = false, closed = false } = {}) {
	const claimButton = new ButtonBuilder()
		.setCustomId(`claimCaseButton:${caseId}`)
		.setLabel(claimed ? 'Claimed' : 'Claim Case')
		.setStyle(claimed ? ButtonStyle.Success : ButtonStyle.Primary)
		.setDisabled(claimed || closed);
	const createWarningButton = new ButtonBuilder()
		.setCustomId(`caseCreateWarningButton:${caseId}`)
		.setLabel('Create Warning')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(closed);
	const noteButton = new ButtonBuilder()
		.setCustomId(`caseAddNoteButton:${caseId}`)
		.setLabel('Add Note')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(closed);
	const closeButton = new ButtonBuilder()
		.setCustomId(`closeCaseButton:${caseId}`)
		.setLabel(closed ? 'Closed' : 'Close Case')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(closed);
	return [new ActionRowBuilder().addComponents(claimButton, createWarningButton, noteButton, closeButton)];
}

// Various confirmation buttons for different actions
function generateReportConfirmationButtons(subjectId, reporterId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmReportSubmissionButton:${subjectId}:${reporterId}`)
		.setLabel('Confirm Report Submission')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateUnmatchedReportConfirmationButtons(reporterId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmUnmatchedReportButton:${reporterId}`)
		.setLabel('Submit Anyway')
		.setStyle(ButtonStyle.Primary);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateCloseCaseConfirmationButtons(caseId, userId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmCloseCaseButton:${caseId}:${userId}`)
		.setLabel('Confirm Close')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateMergeUsersConfirmationButtons(sourceId, targetId, userId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmMergeUsersButton:${sourceId}:${targetId}:${userId}`)
		.setLabel('Confirm Merge')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateCloseReportConfirmationButtons(reportId, userId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmCloseReportButton:${reportId}:${userId}`)
		.setLabel('Confirm Close')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateBanConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmManualPunishmentButton:ban:${dbId}`)
		.setLabel('Ban User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateKickConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmManualPunishmentButton:kick:${dbId}`)
		.setLabel('Kick User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateMuteConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmManualPunishmentButton:mute:${dbId}`)
		.setLabel('Mute User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateUnbanConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmManualPunishmentButton:unban:${dbId}`)
		.setLabel('Unban User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateUnmuteConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmManualPunishmentButton:unmute:${dbId}`)
		.setLabel('Unmute User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateReportReplyConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`reportReplyConfirmButton:${dbId}`)
		.setLabel('Confirm Reply')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(confirmButton, cancelButton)];
}

function generateWarnConfirmationButtons(dbId, moderatorId, recommendedAction, caseId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`executeWarnButton:${dbId}:${moderatorId}:${recommendedAction}:${caseId ?? ''}`)
		.setLabel('Confirm Recommended Action')
		.setStyle(ButtonStyle.Success);
	const overrideButton = new ButtonBuilder()
		.setCustomId(`overrideWarnButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Override Action')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`wardenCancelButton`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return [new ActionRowBuilder().addComponents(confirmButton, overrideButton, cancelButton)];
}

function generateBanApprovalButtons(dbId, moderatorId, caseId) {
	const approveButton = new ButtonBuilder()
		.setCustomId(`approveBanButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Approve Ban')
		.setStyle(ButtonStyle.Success);
	const denyButton = new ButtonBuilder()
		.setCustomId(`denyBanButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Deny Ban')
		.setStyle(ButtonStyle.Danger);
	return [new ActionRowBuilder().addComponents(approveButton, denyButton)];
}

function generateCaseDetailsButtons(caseId) {
	const reportsButton = new ButtonBuilder()
		.setCustomId(`viewCaseReportsButton:${caseId}`)
		.setLabel('View Reports')
		.setStyle(ButtonStyle.Primary);
	const warningsButton = new ButtonBuilder()
		.setCustomId(`viewCaseWarningsButton:${caseId}`)
		.setLabel('View Warnings')
		.setStyle(ButtonStyle.Primary);
	const punishmentsButton = new ButtonBuilder()
		.setCustomId(`viewCasePunishmentsButton:${caseId}`)
		.setLabel('View Punishments')
		.setStyle(ButtonStyle.Primary);
	return [new ActionRowBuilder().addComponents(reportsButton, warningsButton, punishmentsButton)];
}

function generateCaseHistoryPageButtons(type, caseId, index, total) {
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`caseHistoryPage:${type}:${caseId}:${index - 1}`)
				.setLabel('Prev')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index <= 0),
			new ButtonBuilder()
				.setCustomId(`caseHistoryPage:${type}:${caseId}:${index + 1}`)
				.setLabel('Next')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index >= total - 1),
			new ButtonBuilder().setCustomId('caseHistoryClose').setLabel('Close').setStyle(ButtonStyle.Danger),
		),
	];
}

function generateUserHistoryButtons(dbId) {
	const button = (type, label) =>
		new ButtonBuilder().setCustomId(`userHistoryView:${type}:${dbId}`).setLabel(label).setStyle(ButtonStyle.Primary);
	return [
		new ActionRowBuilder().addComponents(
			button('warnings', 'View Warnings'),
			button('cases', 'View Cases'),
			button('reports', 'View Reports'),
			button('punishments', 'View Punishments'),
		),
	];
}

function generateUserHistoryPageButtons(type, dbId, index, total) {
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`userHistoryPage:${type}:${dbId}:${index - 1}`)
				.setLabel('Prev')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index <= 0),
			new ButtonBuilder()
				.setCustomId(`userHistoryPage:${type}:${dbId}:${index + 1}`)
				.setLabel('Next')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index >= total - 1),
			new ButtonBuilder().setCustomId('caseHistoryClose').setLabel('Close').setStyle(ButtonStyle.Danger),
		),
	];
}

module.exports = {
	generateCaseButtons,
	generateCloseCaseConfirmationButtons,
	generateCloseReportConfirmationButtons,
	generateMergeUsersConfirmationButtons,
	generateBanConfirmationButtons,
	generateKickConfirmationButtons,
	generateMuteConfirmationButtons,
	generateReportButtons,
	generateReportUpdateButton,
	generateUnbanConfirmationButtons,
	generateUnmuteConfirmationButtons,
	generateReportReplyConfirmationButtons,
	generateUserSummaryButtons,
	generateReportConfirmationButtons,
	generateUnmatchedReportConfirmationButtons,
	generateReportModButtons,
	generateCaseReportButtons,
	generateWarnConfirmationButtons,
	generateBanApprovalButtons,
	generateCaseDetailsButtons,
	generateCaseHistoryPageButtons,
	generateUserHistoryButtons,
	generateUserHistoryPageButtons,
};
