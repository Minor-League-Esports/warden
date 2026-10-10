const log4js = require('log4js');
const logger = log4js.getLogger('UserUtility');
const { logLevel, mainGuild, tmGuild } = require('../config.json');
logger.level = logLevel;

class UserUtility {
	constructor(discordClient, databaseManager) {
		this._discordRegex = /[0-9]{17,19}/;
		this._mleIdRegex = /[0-9]{4,6}/i;
		this._discordClient = discordClient;
		this._databaseManager = databaseManager;
	}

	/**
	 * Fetches a database user by an unknown identifier type (Discord ID, MLE ID, or username)
	 * @param {String} identifier
	 * @returns {Promise<User>}
	 */
	async fetchDatabaseUser(identifier) {
		// First try to fetch by Discord ID
		if (this._discordRegex.test(identifier)) {
			try {
				const user = await this._databaseManager.getUserByIdentifier(identifier, 'discord');
				if (user === null) {
					throw 'User not found';
				}
				const updatedUser = await this.updateDiscordAvatarFromDatabaseUser(user);
				return updatedUser;
			} catch (error) {
				if (error === 'User not found') {
					// User not found in DB, create new user entry
					try {
						const discordUser = await this._discordClient.users.fetch(identifier);
						try {
							const newUser = await this.createDatabaseUserFromDiscordUser(discordUser);
							return newUser['user'];
						} catch (creationError) {
							logger.error(`Error creating database user from Discord user with ID ${identifier}:`, creationError);
							throw creationError;
						}
					} catch (fetchError) {
						logger.error(`Error fetching Discord user with ID ${identifier}:`, fetchError);
						throw fetchError;
					}
				} else {
					logger.error('Error fetching user:', error);
					throw error;
				}
			}
		} else if (this._mleIdRegex.test(identifier)) {
			// Next try to fetch by MLE ID
			try {
				const user = await this._databaseManager.getUserByIdentifier(identifier, 'mle');
				const updatedUser = await this.updateDiscordAvatarFromDatabaseUser(user);
				return updatedUser;
			} catch (_) {
				_;
				logger.info(`User not found by MLE ID: ${identifier}, trying username.`);
			}
		} else {
			// Finally try to fetch by username
			try {
				const user = await this._findByNameHandleOrAlternate(identifier);
				const updatedUser = await this.updateDiscordAvatarFromDatabaseUser(user);
				return updatedUser;
			} catch (_) {
				_;
				const member = await this._searchGuildsForUsername(identifier);
				if (member) {
					logger.info(`Found ${identifier} via guild member search (${member.id}).`);
					return this.fetchDatabaseUser(member.id);
				}
				logger.info(`User not found by username: ${identifier}.`);
				throw new Error('User not found by any identifier.');
			}
		}
	}

	// Discord has no global username lookup, so only guilds the bot is in can be searched
	async _searchGuildsForUsername(username) {
		for (const guildId of [tmGuild, mainGuild]) {
			const guild = guildId && this._discordClient.guilds.cache.get(guildId);
			if (!guild) continue;
			try {
				const results = await guild.members.search({ query: username, limit: 10 });
				const match = results.find((m) => m.user.username.toLowerCase() === username.toLowerCase());
				if (match) return match.user;
			} catch (error) {
				logger.warn(`Guild member search failed in ${guildId}: ${error}`);
			}
		}
		return null;
	}

	async _findByNameHandleOrAlternate(identifier) {
		for (const type of ['name', 'discordname', 'alt']) {
			const user = await this._databaseManager.getUserByIdentifier(identifier, type);
			if (user) return user;
		}
		throw new Error('User not found');
	}

	/**
	 * Updates the Discord avatar and username of a database user
	 * @param {User} dbUser
	 * @returns {Promise<User>} Updated database user
	 */
	async updateDiscordAvatarFromDatabaseUser(dbUser) {
		// Users identified only by an alternate identifier have no Discord account to sync
		if (!dbUser.getDiscordId()) return dbUser;
		return new Promise((resolve, reject) => {
			this._discordClient.users
				.fetch(dbUser.getDiscordId())
				.then((discordUser) => {
					const changes = {};
					if (dbUser.getDiscordAvatar() !== discordUser.displayAvatarURL()) {
						changes.discord_avatar = discordUser.displayAvatarURL();
					}
					if (dbUser.getDiscordUsername() !== discordUser.username) {
						changes.discord_username = discordUser.username;
					}

					if (Object.keys(changes).length > 0) {
						this._databaseManager
							.updateUser(dbUser.getUserId(), changes)
							.then(() => {
								logger.info(
									`Updated ${Object.keys(changes).join(', ')} for user ${dbUser.getUserName()} (${dbUser.getDiscordId()})`,
								);
								if (changes.discord_avatar) dbUser._discordAvatar = changes.discord_avatar;
								if (changes.discord_username) dbUser._discordUsername = changes.discord_username;
								resolve(dbUser);
							})
							.catch((error) => {
								logger.error('Error updating user avatar/username:', error);
								// Resolve with the original user even if the update fails
								resolve(dbUser);
							});
					} else {
						resolve(dbUser);
					}
				})
				.catch((error) => {
					if (error.code === 10013) {
						reject(new Error(`Failed to find user with ID ${dbUser.getDiscordId()}`));
					} else {
						logger.error(`Unknown error fetching user ${dbUser.getDiscordId()}:\n\`\`\`\n${error}\n\`\`\``);
						reject(error);
					}
				});
		});
	}

	/**
	 * Gets a database user by their Discord ID, creating a new entry if none exists
	 *
	 * @param {String} discordId
	 * @returns {Promise<User>}
	 */
	async createDatabaseUserFromDiscordUser(discordUser) {
		return this._databaseManager.createUser(
			discordUser.id,
			discordUser.username,
			null,
			discordUser.displayAvatarURL(),
			discordUser.username,
		);
	}
}

module.exports = {
	UserUtility,
};
