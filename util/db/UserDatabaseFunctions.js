const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager:User');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

/**
 * Creates a new user object and returns it
 * Updates name and avatar if already exists
 *
 * @param {String} userId The user's Discord ID
 * @param {String} userName The user's Discord username
 * @param {String|null} mleId The user's MLE ID (optional)
 * @param {String|null} discordAvatar The user's Discord avatar URL (optional)
 * @returns {Object} An Object with {user, action, ?reason}
 */
async function createUser(discordId, userName, mleId = null, discordAvatar = null) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	if (!discordId || !userName) {
		throw new Error('discordId and userName are required to create a user');
	}

	// First check if the user already exists
	const existing = await this._queryFile('queries/get/user/getUserByIdentifier_discord.sql', [discordId]);
	const users = globalThis.databaseResponseParser.parseDatabaseUserResponse(existing);

	if (users.length === 1) {
		const user = users[0];

		// User exists, check if we need to update
		let updateName = false;
		let updateAvatar = false;
		if (userName != user.getUserName()) {
			updateName = true;
		}
		if (discordAvatar != null && discordAvatar != user.getDiscordAvatar()) {
			updateAvatar = true;
		}

		if (updateName && updateAvatar) {
			const updated = await this.updateUser(user.getUserId(), {
				user_name: userName,
				discord_avatar: discordAvatar,
			});
			logger.info(`Updated user ${user.getUserId()} with new name and avatar.`);
			return {
				user: updated,
				action: 'updated',
				reason: 'discord_id existed; updated name and avatar',
			};
		} else if (updateName) {
			const updated = await this.updateUser(user.getUserId(), { user_name: userName });
			logger.info(`Updated user ${user.getUserId()} with new name.`);
			return {
				user: updated,
				action: 'updated',
				reason: 'discord_id existed; updated name',
			};
		} else if (updateAvatar) {
			const updated = await this.updateUser(user.getUserId(), { discord_avatar: discordAvatar });
			logger.info(`Updated user ${user.getUserId()} with new avatar.`);
			return {
				user: updated,
				action: 'updated',
				reason: 'discord_id existed; updated avatar',
			};
		} else {
			return {
				user: user,
				action: 'unchanged',
				reason: 'discord_id existed; no changes needed',
			};
		}
	} else {
		// User doesn't exist, create them
		const res = await this._queryFile('queries/insert/insertUser.sql', [discordId, discordAvatar, userName, mleId]);
		const created = globalThis.databaseResponseParser.parseDatabaseUserResponse(res);
		if (created.length !== 1) throw new Error('Failed to create user');
		logger.info(`Created user ${created[0].getUserId()} with discord_id ${discordId}`);
		return {
			user: created[0],
			action: 'created',
		};
	}
}

/**
 * Gets a user object.
 *
 * @param {String} identifier The user's identifier (name, mle id, db id, etc)
 * @returns {Promise<User|null>} A promise to return the User object (may be null)
 */
async function getUserByIdentifier(identifier, type) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile(`queries/get/user/getUserByIdentifier_${type}.sql`, [identifier]);
	const users = globalThis.databaseResponseParser.parseDatabaseUserResponse(res);
	if (users.length !== 1) return null;
	return users[0];
}

/**
 * Updates an existing user object and returns it
 *
 * @param {String} userId The user's Database ID
 * @param {Object} fields An object containing fields to update (e.g., { user_name: 'NewName', discord_avatar: 'NewAvatarURL' })
 * @returns {Promise<User>} A promise to return the updated User object
 */
async function updateUser(userId, fields) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	if (!userId || !fields || Object.keys(fields).length === 0) {
		throw new Error('userId and at least one field are required to update a user');
	}

	// Build dynamic UPDATE statement safely
	const setClauses = Object.keys(fields)
		.map((key, idx) => `${key} = $${idx + 2}`)
		.join(', ');
	const values = [userId, ...Object.values(fields)];

	const res = await this._pool.query(
		`UPDATE Users
                SET ${setClauses}
                WHERE user_id = $1
                RETURNING *`,
		values,
	);

	const users = globalThis.databaseResponseParser.parseDatabaseUserResponse(res);
	if (users.length !== 1) throw new Error('Failed to update user');
	logger.info(`Updated user with user_id ${userId}: ` + JSON.stringify(fields));
	return users[0];
}

module.exports = {
	createUser,
	getUserByIdentifier,
	updateUser,
};
