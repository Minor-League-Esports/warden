const log4js = require('log4js');
const logger = log4js.getLogger('onModalSubmit');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');
const { handleReportUserModalSubmit } = require('./modal/report/onReportUserModalSubmit');
const { handleReportUpdateModalSubmit } = require('./modal/report/onReportUpdateModalSubmit');
const { handleReportReplyModalSubmit } = require('./modal/report/onReportReplyModalSubmit');
const { handleModeratorAddNoteModalSubmit } = require('./modal/onModeratorAddNoteModalSubmit');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		const modalId = interaction.customId;

		if (modalId.startsWith('reportUserModal')) {
			await handleReportUserModalSubmit(interaction);
		} else if (modalId.startsWith('reportUpdateModal')) {
			await handleReportUpdateModalSubmit(interaction);
		} else if (modalId.startsWith('reportReplyModal')) {
			await handleReportReplyModalSubmit(interaction);
		} else if (modalId.startsWith('addModeratorNoteModal')) {
			await handleModeratorAddNoteModalSubmit(interaction);
		}
	},
};
