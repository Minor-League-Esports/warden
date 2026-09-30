const log4js = require('log4js');
const logger = log4js.getLogger('onButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');
const { handleOpenUserReportModalButtonClick } = require('./button/report/onOpenUserReportModalButtonClick');
const { handleConfirmReportSubmissionButtonClick } = require('./button/report/onConfirmReportSubmissionButtonClick');
const { handleAcknowledgeReportButtonClick } = require('./button/report/onAcknowledgeReportButtonClick');
const { handleCloseReportButtonClick } = require('./button/report/onCloseReportButtonClick');
const { handleConfirmCloseReportButtonClick } = require('./button/report/onConfirmCloseReportButtonClick');
const { handleReportReplyButtonClick } = require('./button/report/onReportReplyButtonClick');
const { handleReportAddNoteButtonClick } = require('./button/report/onReportAddNoteButtonClick');
const { handleReportConfirmReplyButtonClick } = require('./button/report/onReportConfirmReplyButtonClick');

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
		}
	},
};
