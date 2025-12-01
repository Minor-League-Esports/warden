const { DataParser } = require('./DataParser');
const { Logger } = require('./Logger');
const { RemoteManager } = require('./RemoteManager');
const { opsLogChannelId } = require('../config.json');

let instancePromise = null;

async function getDataParser(client) {
	if (instancePromise) return instancePromise;
	instancePromise = (async () => {
		// Create dependencies once (after client is ready so channels can be fetched)
		const logChannel = await client.channels.fetch(opsLogChannelId);
		const logger = new Logger(logChannel);
		const remoteManager = new RemoteManager(logger);
		return new DataParser(remoteManager);
	})();
	return instancePromise;
}

module.exports = { getDataParser };
