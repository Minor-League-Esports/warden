const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager:User');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { calculateCurrentPoints } = require('../UtilFunctions');

// Every column that references Users(user_id)
const USER_REFERENCES = {
	Cases: ['creator_id', 'subject_id', 'moderator_id'],
	Reports: ['reporter_id', 'subject_id', 'moderator_id'],
	Warnings: ['subject_id', 'moderator_id'],
	Punishments: ['subject_id', 'moderator_id'],
};

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

/**
 * Moves every case, report, warning, and punishment from one user to another, then deletes the source user.
 * Runs as one transaction and recomputes the target's warning point totals afterward.
 *
 * @param {String} sourceId DB user_id of the profile being merged away
 * @param {String} targetId DB user_id of the profile being kept
 * @returns {Promise<{caseIds: Number[], reports: Number, warnings: Number, punishments: Number}>} What was moved
 */
async function mergeUsers(sourceId, targetId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}
	if (String(sourceId) === String(targetId)) {
		throw new Error('Cannot merge a user into themselves');
	}

	const client = await this._pool.connect();
	try {
		await client.query('BEGIN');

		const users = await client.query(
			'SELECT user_id, mle_id FROM Users WHERE user_id = ANY($1::int[]) FOR UPDATE',
			[[sourceId, targetId]],
		);
		const source = users.rows.find((row) => String(row.user_id) === String(sourceId));
		const target = users.rows.find((row) => String(row.user_id) === String(targetId));
		if (!source || !target) throw new Error('User not found');

		// Count affected rows before updating, since one row can reference the source in several columns
		const counts = {};
		for (const [table, columns] of Object.entries(USER_REFERENCES)) {
			const where = columns.map((column) => `${column} = $1`).join(' OR ');
			const res = await client.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`, [sourceId]);
			counts[table] = res.rows[0].n;
		}
		const caseRes = await client.query(
			'SELECT case_id FROM Cases WHERE creator_id = $1 OR subject_id = $1 OR moderator_id = $1',
			[sourceId],
		);

		for (const [table, columns] of Object.entries(USER_REFERENCES)) {
			for (const column of columns) {
				await client.query(`UPDATE ${table} SET ${column} = $2 WHERE ${column} = $1`, [sourceId, targetId]);
			}
		}

		if (!target.mle_id && source.mle_id) {
			await client.query('UPDATE Users SET mle_id = $2 WHERE user_id = $1', [targetId, source.mle_id]);
		}
		await client.query('DELETE FROM Users WHERE user_id = $1', [sourceId]);

		// Point totals are cumulative per user, so the merged history needs them rebuilt in order
		const warningRes = await client.query(
			'SELECT warning_id, timestamp, points_added, new_point_total FROM Warnings WHERE subject_id = $1 ORDER BY timestamp ASC, warning_id ASC',
			[targetId],
		);
		const warnings = warningRes.rows;
		for (let i = 0; i < warnings.length; i++) {
			const before = calculateCurrentPoints(warnings.slice(0, i), warnings[i].timestamp);
			const total = before + (warnings[i].points_added || 0);
			if (total !== warnings[i].new_point_total) {
				await client.query('UPDATE Warnings SET new_point_total = $2 WHERE warning_id = $1', [
					warnings[i].warning_id,
					total,
				]);
			}
		}

		await client.query('COMMIT');
		logger.info(`Merged user ${sourceId} into user ${targetId}`);
		return {
			caseIds: caseRes.rows.map((row) => row.case_id),
			reports: counts.Reports,
			warnings: counts.Warnings,
			punishments: counts.Punishments,
		};
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		logger.error(`Error merging user ${sourceId} into ${targetId}: ${error}`);
		throw error;
	} finally {
		client.release();
	}
}

module.exports = {
	createUser,
	getUserByIdentifier,
	updateUser,
	mergeUsers,
};
