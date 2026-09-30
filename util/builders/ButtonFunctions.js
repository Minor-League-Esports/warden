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
	const actionRow = new ActionRowBuilder().addComponents(reportButton);
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

function generateUserSummaryButtons(dbId, caseId = null) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`userConfirmWarnButton:${dbId}:${caseId ?? ''}`)
		.setLabel('Warn User')
		.setStyle(ButtonStyle.Success);
	// TODO: Implement 'update user'
	const updateButton = new ButtonBuilder()
		.setCustomId(`userUpdateButton:${dbId}`)
		.setLabel('[Unimplemented]')
		.setStyle(ButtonStyle.Danger);
	const viewButton = new ButtonBuilder()
		.setCustomId(`userViewHistoryButton:${dbId}`)
		.setLabel('View History')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, updateButton, viewButton);
	return [actionRow];
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
	return new ActionRowBuilder().addComponents(claimButton, createWarningButton, noteButton, closeButton);
}

// Various confirmation buttons for different actions
function generateReportConfirmationButtons(subjectId, reporterId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmReportSubmissionButton:${subjectId}:${reporterId}`)
		.setLabel('Confirm Report Submission')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelReportSubmissionButton:${reporterId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}

function generateCloseCaseConfirmationButtons(caseId, userId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmCloseCaseButton:${caseId}:${userId}`)
		.setLabel('Confirm Close')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelCloseCaseButton:${caseId}:${userId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return new ActionRowBuilder().addComponents(confirmButton, cancelButton);
}

function generateCloseReportConfirmationButtons(reportId, userId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`confirmCloseReportButton:${reportId}:${userId}`)
		.setLabel('Confirm Close')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelCloseReportButton:${reportId}:${userId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	return new ActionRowBuilder().addComponents(confirmButton, cancelButton);
}

function generateBanConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`banConfirmButton:${dbId}`)
		.setLabel('Ban User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelBanButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}

function generateKickConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`kickConfirmButton:${dbId}`)
		.setLabel('Kick User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelKickButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}

function generateMuteConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`muteConfirmButton:${dbId}`)
		.setLabel('Mute User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelMuteButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}

function generateUnbanConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`unbanConfirmButton:${dbId}`)
		.setLabel('Unban User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelUnbanButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}

function generateUnmuteConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`unmuteConfirmButton:${dbId}`)
		.setLabel('Unmute User')
		.setStyle(ButtonStyle.Success);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelUnmuteButton:${dbId}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
	return [actionRow];
}

module.exports = {
	generateCaseButtons,
	generateCloseCaseConfirmationButtons,
	generateCloseReportConfirmationButtons,
	generateBanConfirmationButtons,
	generateKickConfirmationButtons,
	generateMuteConfirmationButtons,
	generateReportButtons,
	generateReportUpdateButton,
	generateUnbanConfirmationButtons,
	generateUnmuteConfirmationButtons,
	generateUserSummaryButtons,
	generateReportConfirmationButtons,
	generateReportModButtons,
	generateCaseReportButtons,
};
