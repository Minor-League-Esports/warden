const log4js = require('log4js');
const logger = log4js.getLogger('onCancelButtonClick');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');

async function handleCancelButtonClick(interaction) {
	await interaction.message.edit({ content: 'Action cancelled.', components: [] });
	await interaction.reply({ content: 'Action cancelled.', flags: MessageFlags.Ephemeral });
}

module.exports = {
	handleCancelButtonClick,
};
