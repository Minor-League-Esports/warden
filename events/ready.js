const log4js = require('log4js');
const logger = log4js.getLogger('ReadyEvent');
const { logLevel, opsLogChannelId } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');
const { DiscordLogger } = require('../util/DiscordLogger.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		const discordLogger = new DiscordLogger(client, opsLogChannelId);
		try {
			await discordLogger.init();
		} catch (error) {
			logger.warn('Failed to initialize DiscordLogger', error);
		}

		discordLogger.logMessage('Bot is ready');
		logger.info(`Ready! Logged in as ${client.user.tag}`);

		globalThis.databaseManager
			.init()
			.then(() => {
				discordLogger.logMessage('Database Manager initialized');
			})
			.catch((error) => {
				logger.error(error);
				discordLogger.logMessage('Database Manager failed to initialize!');
			});
	},
};
