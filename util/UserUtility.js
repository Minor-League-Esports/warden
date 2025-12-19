const log4js = require('log4js');
const logger = log4js.getLogger('UserUtility');
const { logLevel } = require('../config.json');
logger.level = logLevel;

class UserUtility {
	constructor(discordClient, databaseManager) {
		this._discordClient = discordClient;
		this._databaseManager = databaseManager;
	}

	/**
	 * Gets a database user by their Discord ID, creating a new entry if none exists
	 *
	 * @param {String} discordId
	 * @returns {Promise<User>}
	 */
	async fetchDatabaseUserByDiscordId(discordId) {
		return new Promise((resolve, reject) => {
			this._discordClient.users
				.fetch(discordId)
				.then((discordUser) => {
					this._databaseManager
						.getUserByDiscordId(discordId)
						.then((dbUser) => {
							resolve(dbUser);
						})
						.catch((error) => {
							if (error === 'User not found') {
								// User not found in DB, create new user entry
								this._databaseManager
									.createUser(discordId, discordUser.username, null, discordUser.displayAvatarURL())
									.then((user) => {
										resolve(user['user']);
									})
									.catch((creationError) => {
										logger.error('Error creating user:', creationError);
										reject(creationError);
									});
							} else {
								logger.error('Error fetching user:', error);
								reject(error);
							}
						});
				})
				.catch((error) => {
					if (error.code === 10013) {
						reject(new Error(`Failed to find user with ID ${discordId}`));
					} else {
						logger.error(`Unknown error fetching user ${discordId}:\n\`\`\`\n${error}\n\`\`\``);
						reject(error);
					}
				});
		});
	}
}

module.exports = {
	UserUtility,
};
