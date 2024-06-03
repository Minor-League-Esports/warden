const { Events } = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { logChannelId } = require('../config.json');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		const logChannel = await client.channels.fetch(logChannelId);
		const logger = new Logger(logChannel);
		logger.logMessage('Bot is ready');
	}
};
