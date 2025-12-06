const log4js = require('log4js');
const logger = log4js.getLogger('ModalSubmit');
const { logLevel, opsLogChannelId } = require('../config.json');
logger.level = logLevel;

const { DataParser } = require('./DataParser');
const { DiscordLogger } = require('../util/DiscordLogger');
const { RemoteManager } = require('./RemoteManager');

let instancePromise = null;

async function getDataParser(client) {
	if (instancePromise) return instancePromise;
	instancePromise = (async () => {
		// Create dependencies once (after client is ready so channels can be fetched)
		// Set up loggers
		const discordLogger = new DiscordLogger(client, opsLogChannelId);
		try {
			await discordLogger.init();
		} catch (error) {
			logger.warn('Failed to initialize DiscordLogger', error);
		}

		const remoteManager = new RemoteManager(discordLogger);
		return new DataParser(remoteManager);
	})();
	return instancePromise;
}

module.exports = { getDataParser };
