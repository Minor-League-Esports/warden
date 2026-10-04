const log4js = require('log4js');
const logger = log4js.getLogger('onCancelButtonClick');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

async function handleCancelButtonClick(interaction) {
	// update() edits the clicked message directly, which works for ephemeral messages where message.edit() fails
	await interaction.update({ content: 'Action cancelled.', components: [] });
}

module.exports = {
	handleCancelButtonClick,
};
