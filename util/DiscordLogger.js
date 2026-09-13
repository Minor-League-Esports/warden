const log4js = require('log4js');
const logger = log4js.getLogger('DiscordLogger');
const { logLevel } = require('../config.json');
logger.level = logLevel;

class DiscordLogger {
	constructor(client, channelId) {
		this._client = client;
		this._channelId = channelId;
		this._status = 'init';
	}

	/**
	 * Gets the status of the logger
	 * @returns {String} The current logger status
	 */
	getStatus() {
		return this._status;
	}

	/**
	 * Initializes the logger
	 * @param None
	 * @returns {Promise} A promise to initialize the logger
	 */
	async init() {
		return new Promise((resolve, reject) => {
			if (this._client === undefined) {
				logger.warn('Client is undefined');
				this._status = 'failed';
				reject();
			} else if (this._client.channels === undefined) {
				logger.warn('Client channels is undefined');
				this._status = 'failed';
				reject();
			} else {
				this._client.channels
					.fetch(this._channelId)
					.then((channel) => {
						if (!channel.viewable) {
							logger.warn(`Channel with ID ${this._channelId} is not viewable`);
							this._status = 'failed';
							reject();
						} else {
							logger.debug(
								`Successfully fetched channel with ID ${this._channelId}`,
							);
							this._channel = channel;
							this._status = 'success';
							resolve();
						}
					})
					.catch((error) => {
						logger.warn(error);
						if (error.code === 50035) {
							// Error code for invalid form body
							logger.warn(`Channel ID ${this._channelId} is badly formatted`);
						} else if (error.code === 10003) {
							// Error code for unknown channel
							logger.warn(`Could not find channel with ID ${this._channelId}`);
						} else {
							logger.warn('Failed to fetch channel, reason unknown');
							logger.warn(error);
						}
						this._status = 'failed';
						reject();
					});
			}
		});
	}

	/**
	 * Logs a message
	 * @param {*} message
	 * @returns None
	 */
	async logMessage(message) {
		if (this._status === 'init') {
			logger.warn('Tried to log a message, logger not initialized');
			return 'Logger has not been initialized';
		} else if (this._status === 'failed') {
			logger.warn('Tried to log a message, logger failed to initialize');
			return 'Logger failed to initialize';
		}

		if (!message || message.length === 0) {
			logger.warn('An empty log message was sent');
			message = 'An empty log message was sent.';
		}

		message = message.toString();
		const result = message.match(/.{1,2000}/s) || [];

		result.forEach(async (newMessage) => {
			await this._channel.send(newMessage).catch((error) => {
				if (error.code === 50013) {
					// Error code for missing permissions
					logger.warn('No permission to message in log channel');
				} else if (error.code === 50001) {
					// Error code for missing access
					logger.warn('No permission to view log channel');
				} else {
					logger.warn('Failed send log message, reason unknown');
					logger.warn(error);
				}
			});
		});
	}
}

module.exports = {
	DiscordLogger,
};
