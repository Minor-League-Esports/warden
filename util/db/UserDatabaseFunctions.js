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

function describeUser(user) {
	return (
		`#${user.getUserId()} {name: ${user.getUserName()}, discord_id: ${user.getDiscordId()}, ` +
		`discord_username: ${user.getDiscordUsername()}, mle_id: ${user.getMleId()}, ` +
		`alternate_identifier: ${user.getAlternateIdentifier()}, avatar: ${user.getDiscordAvatar()}}`
	);
}

/**
 * Creates a new user object and returns it
 * Updates name and avatar if already exists
 *
 * @param {String} discordId The user's Discord ID
 * @param {String} userName The user's Discord username
 * @param {String|null} mleId The user's MLE ID (optional)
 * @param {String|null} discordAvatar The user's Discord avatar URL (optional)
 * @param {String|null} discordUsername The user's Discord handle (optional)
 * @param {String|null} alternateIdentifier Free-form alternate name for lookups (optional)
 * @returns {Object} An Object with {user, action, ?reason}
 */
async function createUser(
	discordId,
	userName,
	mleId = null,
	discordAvatar = null,
	discordUsername = null,
	alternateIdentifier = null,
) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	if (!userName || (!discordId && !mleId)) {
		throw new Error('userName and either discordId or mleId are required to create a user');
	}

	// Users without a Discord ID are matched by MLE ID
	const lookupFile = discordId ? 'getUserByIdentifier_discord' : 'getUserByIdentifier_mle';
	const existing = await this._queryFile(`queries/get/user/${lookupFile}.sql`, [discordId || mleId]);
	const users = globalThis.databaseResponseParser.parseDatabaseUserResponse(existing);

	if (users.length === 1) {
		const user = users[0];

		// User exists, check if we need to update
		const changes = {};
		if (userName != user.getUserName()) changes.user_name = userName;
		if (discordAvatar != null && discordAvatar != user.getDiscordAvatar()) changes.discord_avatar = discordAvatar;
		if (discordUsername != null && discordUsername != user.getDiscordUsername()) {
			changes.discord_username = discordUsername;
		}
		if (alternateIdentifier != null && alternateIdentifier != user.getAlternateIdentifier()) {
			changes.alternate_identifier = alternateIdentifier;
		}

		if (Object.keys(changes).length > 0) {
			const updated = await this.updateUser(user.getUserId(), changes);
			const fields = Object.keys(changes).join(', ');
			logger.info(`Updated user ${describeUser(updated)} (changed: ${fields}).`);
			return {
				user: updated,
				action: 'updated',
				reason: `discord_id existed; updated ${fields}`,
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
		const res = await this._queryFile('queries/insert/insertUser.sql', [
			discordId || null,
			discordAvatar,
			userName,
			mleId,
			discordUsername,
			alternateIdentifier,
		]);
		const created = globalThis.databaseResponseParser.parseDatabaseUserResponse(res);
		if (created.length !== 1) throw new Error('Failed to create user');
		logger.info(`Created user ${describeUser(created[0])}`);
		return {
			user: created[0],
			action: 'created',
		};
	}
}

/**
 * Creates a user with no Discord account, identified only by free-form text a reporter entered.
 * Returns the existing user if that alternate identifier is already stored.
 *
 * @param {String} identifier The text the reporter entered
 * @returns {Promise<User>}
 */
async function createUserByAlternateIdentifier(identifier) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const existing = await this.getUserByIdentifier(identifier, 'alt');
	if (existing) return existing;

	const res = await this._queryFile('queries/insert/insertUser.sql', [null, null, identifier, null, null, identifier]);
	const created = globalThis.databaseResponseParser.parseDatabaseUserResponse(res);
	if (created.length !== 1) throw new Error('Failed to create user');
	logger.info(`Created user ${created[0].getUserId()} from alternate identifier '${identifier}'`);
	return created[0];
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

		const users = await client.query('SELECT user_id, mle_id, discord_username, alternate_identifier FROM Users WHERE user_id = ANY($1::int[]) FOR UPDATE', [
			[sourceId, targetId],
		]);
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
		const reportRes = await client.query(
			'SELECT report_id FROM Reports WHERE reporter_id = $1 OR subject_id = $1 OR moderator_id = $1',
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
		for (const column of ['discord_username', 'alternate_identifier']) {
			if (!target[column] && source[column]) {
				await client.query(`UPDATE Users SET ${column} = $2 WHERE user_id = $1`, [targetId, source[column]]);
			}
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
			reportIds: reportRes.rows.map((row) => row.report_id),
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
	createUserByAlternateIdentifier,
	getUserByIdentifier,
	updateUser,
	mergeUsers,
};
