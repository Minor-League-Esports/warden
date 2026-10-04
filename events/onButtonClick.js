const log4js = require('log4js');
const logger = log4js.getLogger('onButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');
const { handleOpenUserReportModalButtonClick } = require('./button/report/user/onOpenUserReportModalButtonClick');
const {
	handleConfirmReportSubmissionButtonClick,
} = require('./button/report/user/onConfirmReportSubmissionButtonClick');
const { handleAcknowledgeReportButtonClick } = require('./button/report/mod/onAcknowledgeReportButtonClick');
const { handleCloseReportButtonClick } = require('./button/report/mod/onCloseReportButtonClick');
const { handleConfirmCloseReportButtonClick } = require('./button/report/mod/onConfirmCloseReportButtonClick');
const { handleReportReplyButtonClick } = require('./button/report/mod/onReportReplyButtonClick');
const { handleReportAddNoteButtonClick } = require('./button/report/mod/onReportAddNoteButtonClick');
const { handleReportConfirmReplyButtonClick } = require('./button/report/mod/onReportConfirmReplyButtonClick');
const { handleReportUpdateButtonClick } = require('./button/report/user/onReportUpdateButtonClick');
const { handleClaimCaseButtonClick } = require('./button/case/onClaimCaseButtonClick');
const { handleCaseCloseButtonClick } = require('./button/case/onCaseCloseButtonClick');
const { handleConfirmCloseCaseButtonClick } = require('./button/case/onConfirmCloseCaseButtonClick');
const { handleCaseAddNoteButtonClick } = require('./button/case/onCaseAddNoteButtonClick');
const { handleCancelButtonClick } = require('./button/onCancelButtonClick');
const { handleCaseCreateWarningButtonClick } = require('./button/case/onCaseCreateWarningButtonClick');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;
		const buttonId = interaction.customId;

		if (buttonId.startsWith('openUserReportModalButton')) {
			await handleOpenUserReportModalButtonClick(interaction);
		} else if (buttonId.startsWith('confirmReportSubmissionButton')) {
			await handleConfirmReportSubmissionButtonClick(interaction);
		} else if (buttonId.startsWith('reportAcknowledgeButton')) {
			await handleAcknowledgeReportButtonClick(interaction);
		} else if (buttonId.startsWith('reportCloseButton')) {
			await handleCloseReportButtonClick(interaction);
		} else if (buttonId.startsWith('confirmCloseReportButton')) {
			await handleConfirmCloseReportButtonClick(interaction);
		} else if (buttonId.startsWith('reportReplyButton')) {
			await handleReportReplyButtonClick(interaction);
		} else if (buttonId.startsWith('reportAddNoteButton')) {
			await handleReportAddNoteButtonClick(interaction);
		} else if (buttonId.startsWith('reportReplyConfirmButton')) {
			await handleReportConfirmReplyButtonClick(interaction);
		} else if (buttonId.startsWith('reportUpdateButton')) {
			await handleReportUpdateButtonClick(interaction);
		} else if (buttonId.startsWith('claimCaseButton')) {
			await handleClaimCaseButtonClick(interaction);
		} else if (buttonId.startsWith('caseCreateWarningButton')) {
			await handleCaseCreateWarningButtonClick(interaction);
		} else if (buttonId.startsWith('closeCaseButton')) {
			await handleCaseCloseButtonClick(interaction);
		} else if (buttonId.startsWith('confirmCloseCaseButton')) {
			await handleConfirmCloseCaseButtonClick(interaction);
		} else if (buttonId.startsWith('caseAddNoteButton')) {
			await handleCaseAddNoteButtonClick(interaction);
		} else if (buttonId.startsWith('cancel')) {
			await handleCancelButtonClick(interaction);
		}
	},
};
