const log4js = require('log4js');
const logger = log4js.getLogger('onDenyBanButtonClick');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { PermissionFlagsBits } = require('discord.js');

async function handleDenyBanButtonClick(interaction) {
	// Check permissions
	if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
		logger.warn(`User ${interaction.user.id} attempted to deny a ban without sufficient permissions.`);
		await interaction.reply({ content: 'You do not have permission to deny bans.' });
		return;
	}

	// Remove buttons after click
	await interaction.update({
		components: [],
	});
	await interaction.followUp({ content: `Ban has been denied by <@${interaction.user.id}>.` });
}

module.exports = {
	handleDenyBanButtonClick,
};
