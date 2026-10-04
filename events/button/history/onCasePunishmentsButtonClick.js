const log4js = require('log4js');
const logger = log4js.getLogger('onCasePunishmentsButtonClick');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');

async function handleCasePunishmentsButtonClick(interaction) {
	const buttonId = interaction.customId;
	const [, dbId] = buttonId.split(':');
	await interaction.deferReply();
}

module.exports = {
	handleCasePunishmentsButtonClick,
};
