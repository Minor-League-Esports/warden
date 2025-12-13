const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager');
const { database, logLevel } = require('../config.json');
logger.level = logLevel;

const { Client } = require('pg');
const Warning = require('./entity/Warning');
const User = require('./entity/User');
const { calculateCurrentPoints } = require('./UtilFunctions');

class DatabaseManager {
	constructor() {
		this._status = 'init';
		this._client = new Client({
			user: database['username'],
			password: database['password'],
			host: database['hostname'],
			port: database['port'],
			database: database['database'],
			ssl: {
				rejectUnauthorized: true,
				servername: database['hostname'],
			},
		});
	}

	/**
	 * Initializes the database connection
	 * @param None
	 * @returns {Promise<boolean>} A promise to initialize the connection
	 */
	async init() {
		// Sets status to 'success' on success and 'failed' on fail
		await this._client.connect();

		// Drop existing tables for testing purposes
		// await this._client.query('DROP TABLE IF EXISTS Punishments');
		// await this._client.query('DROP TABLE IF EXISTS Warnings');
		// await this._client.query('DROP TABLE IF EXISTS Users');

		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Users (
				user_id SERIAL PRIMARY KEY,
				discord_id TEXT NOT NULL UNIQUE,
				discord_avatar TEXT,
				user_name TEXT NOT NULL,
				mle_id TEXT
			)`,
		);

		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Warnings (
				warning_id SERIAL PRIMARY KEY,
				user_id INT REFERENCES Users(user_id) NOT NULL,
				moderator_id INT REFERENCES Users(user_id) NOT NULL,
				reporter_id INT REFERENCES Users(user_id),
				timestamp TIMESTAMPTZ NOT NULL,
				rules_broken TEXT NOT NULL,
				violating_content TEXT NOT NULL,
				points_added INT NOT NULL,
				actions_taken TEXT NOT NULL,
				new_point_total INT NOT NULL,
				moderator_notes TEXT
			)`,
		);

		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Punishments (
				punishment_id SERIAL PRIMARY KEY,
				user_id INT REFERENCES Users(user_id) NOT NULL,
				moderator_id INT REFERENCES Users(user_id) NOT NULL,
				warning_id INT REFERENCES Warnings(warning_id),
				timestamp TIMESTAMPTZ NOT NULL,
				is_mute BOOLEAN NOT NULL,
				mute_duration INT,
				is_unmute BOOLEAN NOT NULL,
				is_suspension BOOLEAN NOT NULL,
				suspension_duration INT,
				is_ban BOOLEAN NOT NULL,
				is_unban BOOLEAN NOT NULL
			)`,
		);
		this._status = 'success';
		logger.debug('Initialized the database connection');
	}

	/**
	 * Gets a user object.
	 * Returns basic user data and basic info of warnings
	 * Enough to display user summary
	 * Count of warnings and point calculation done in User object
	 *
	 * @param {String} userId The user's Discord ID
	 * @returns {Promise<User>} A promise to return the User object
	 */
	async getUserByDiscordId(userId) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			// Single query: get user row and all joined warnings with names
			this._client
				.query(
					`SELECT 
						u.user_id AS user_id,
						u.discord_id AS discord_id,
						u.discord_avatar AS discord_avatar,
						u.user_name AS user_name,
						u.mle_id AS mle_id,
						w.warning_id AS warning_id,
						w.user_id AS w_user_id,
						w.timestamp AS timestamp,
						w.points_added AS points_added
					FROM Users u
					LEFT JOIN Warnings w ON w.user_id = u.user_id
					WHERE u.discord_id = $1
					ORDER BY w.timestamp DESC NULLS LAST
					`,
					[userId],
				)
				.then((result) => {
					const rows = result.rows;
					if (!rows || rows.length === 0) {
						return reject('User not found');
					}

					// Build user from first row
					const first = rows[0];
					const user = new User(
						first['user_id'],
						first['discord_id'],
						first['discord_avatar'],
						first['user_name'],
						first['mle_id'],
					);

					// Aggregate warnings from all rows where a warning exists
					const warnings = [];
					for (const row of rows) {
						if (row['warning_id'] == null) continue;
						const w = new Warning();
						w.setUserId(row['w_user_id'] ?? row['user_id']);
						w.setUserName(first['user_name']);
						w.setTimestamp(row['timestamp']);
						w.setPointsAdded(row['points_added']);
						warnings.push(w);
					}

					user.setWarnings(warnings);
					return resolve(user);
				})
				.catch((error) => {
					logger.error('Error getting user!');
					logger.error(error);
					return reject('Error getting user');
				});
		});
	}

	/**
	 * Creates a new user object and returns it
	 *
	 * @param {String} userId The user's Discord ID
	 * @param {String} userName The user's Discord username
	 * @param {String} mleId The user's MLE ID (optional)
	 * @param {String} discordAvatar The user's Discord avatar URL (optional)
	 * @returns {Promise<User>} A promise to return the newly created User object
	 */
	async createUser(discordId, userName, mleId = null, discordAvatar = null) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			if (!discordId || !userName) {
				return reject('discordId and userName are required to create a user');
			}

			// Check if a user with this discord_id already exists
			this._client
				.query(
					`SELECT user_id, discord_id, discord_avatar, user_name, mle_id
                     FROM Users
                     WHERE discord_id = $1
                     LIMIT 1`,
					[discordId],
				)
				.then(async (existing) => {
					if (existing.rows.length > 0) {
						// If exists, update fields only if different
						const current = existing.rows[0];
						const currentName = current.user_name;
						const currentAvatar = current.discord_avatar;
						let needsUpdate = false;
						const updates = [];
						if (userName && currentName !== userName) {
							updates.push({ key: 'user_name', value: userName });
							needsUpdate = true;
						}
						if (discordAvatar !== null && discordAvatar !== undefined && currentAvatar !== discordAvatar) {
							updates.push({ key: 'discord_avatar', value: discordAvatar });
							needsUpdate = true;
						}

						if (needsUpdate) {
							// Build dynamic UPDATE statement safely
							const setClauses = updates.map((u, idx) => `${u.key} = $${idx + 2}`).join(', ');
							const values = [discordId, ...updates.map((u) => u.value)];
							const updateRes = await this._client.query(
								`UPDATE Users
								 SET ${setClauses}
								 WHERE discord_id = $1
								 RETURNING user_id, discord_id, discord_avatar, user_name, mle_id`,
								values,
							);
							const user = this.parseDatabaseUserResponse(updateRes);
							logger.debug(
								`Updated user for discord_id ${discordId}: ` + updates.map((u) => `${u.key} -> ${u.value}`).join(', '),
							);
							return resolve({
								user,
								action: 'updated',
								reason: 'discord_id existed; fields updated to match dataset',
							});
						}

						const user = this.parseDatabaseUserResponse(existing);
						return resolve({
							user,
							action: 'unchanged',
							reason: 'discord_id already in use; no field changes',
						});
					}

					// Insert new user
					return this._client
						.query(
							`INSERT INTO Users (discord_id, user_name, mle_id, discord_avatar)
                             VALUES ($1, $2, $3, $4)
                             RETURNING user_id, discord_id, discord_avatar, user_name, mle_id`,
							[discordId, userName, mleId, discordAvatar],
						)
						.then((result) => {
							const user = this.parseDatabaseUserResponse(result);
							logger.debug(`Created new user with discord_id ${discordId} and user_name "${userName}"`);
							if (user === null) return reject('Failed to create user');
							return resolve({
								user,
								action: 'created',
							});
						});
				})
				.catch((error) => {
					logger.error('Error creating user!');
					logger.error(error);
					return reject('Error creating user');
				});
		});
	}

	/**
	 * Gets a user's warnings
	 *
	 * @param {String} userId The user's Database ID
	 * @returns {Promise<Warning[]>} A promise to return an array of Warning objects
	 */
	async getWarnings(userId) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query(
					`SELECT 
						w.*, 
						u_user.user_name AS user_name,
						u_user.discord_id AS discord_id,
						u_user.discord_avatar AS user_avatar,
						u_mod.user_name AS moderator_name,
						u_rep.user_name AS reporter_name
					FROM Warnings w
					LEFT JOIN Users u_user ON u_user.user_id = w.user_id
					LEFT JOIN Users u_mod ON u_mod.user_id = w.moderator_id
					LEFT JOIN Users u_rep ON u_rep.user_id = w.reporter_id
					WHERE w.user_id = $1
					ORDER BY w.timestamp DESC`,
					[userId],
				)
				.then((warningResult) => {
					return resolve(this.parseDatabaseWarningResponse(warningResult));
				})
				.catch((error) => {
					logger.error('Error getting warnings!');
					logger.error(error);
					return reject('Error getting warnings');
				});
		});
	}

	/**
	 * Creates a new warning for a user
	 *
	 * @param {String} userId DB ID of the user being warned
	 * @param {String} moderatorId DB ID of the moderator issuing the warning
	 * @param {String} reporterId DB ID of the reporter (can be null)
	 * @param {String} rulesBroken The rules broken by the user
	 * @param {String} violatingContent The content that violated the rules
	 * @param {Number} pointsAdded Number of points added by this warning
	 * @param {String} actionsTaken Actions taken against the user
	 * @param {String} moderatorNotes Private notes for moderator reference (optional)
	 * @param {String} timestamp Optional timestamp; defaults to now (ex 2025-12-12 20:23:22.611 -0600)
	 * @returns {Warning} The newly created warning object
	 */
	async createWarning(
		userId,
		moderatorId,
		reporterId,
		rulesBroken,
		violatingContent,
		pointsAdded,
		actionsTaken,
		moderatorNotes = null,
		timestamp = new Date().toISOString(),
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		try {
			// Get existing warnings to compute current points at time of warn
			const existingWarnings = await this.getWarnings(userId);
			const currentPoints = calculateCurrentPoints(existingWarnings);
			const newPointTotal = currentPoints + (pointsAdded || 0);

			const result = await this._client.query(
				`INSERT INTO Warnings 
                (user_id, moderator_id, reporter_id, timestamp, rules_broken, violating_content, points_added, actions_taken, new_point_total, moderator_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *`,
				[
					userId,
					moderatorId,
					reporterId,
					timestamp,
					rulesBroken,
					violatingContent,
					pointsAdded,
					actionsTaken,
					newPointTotal,
					moderatorNotes,
				],
			);

			const warnings = this.parseDatabaseWarningResponse(result);
			if (warnings.length === 0) {
				throw new Error('Failed to create warning');
			}
			return warnings[0];
		} catch (error) {
			logger.error('Error creating warning!');
			logger.error(error);
			throw new Error('Error creating warning');
		}
	}

	/**
	 * Parses raw database data into a User object
	 *
	 * @param {*} result The raw DB data
	 * @returns {User} The parsed User
	 */
	parseDatabaseUserResponse(userResult) {
		const rows = userResult.rows;

		if (rows.length === 0) {
			return null;
		}

		const userRow = rows[0];
		const userId = userRow['user_id'];
		const discordId = userRow['discord_id'];
		const discordAvatar = userRow['discord_avatar'];
		const userName = userRow['user_name'];
		const mleId = userRow['mle_id'];

		const user = new User(userId, discordId, discordAvatar, userName, mleId);

		return user;
	}

	/**
	 * Parses raw database data into an array of Warnings
	 *
	 * @param {*} result The raw DB data
	 * @returns {Warning[]} The parsed Warnings
	 */
	parseDatabaseWarningResponse(warningResult) {
		const rows = warningResult.rows;

		const warnings = [];
		for (const row of rows) {
			const warning = new Warning();
			warning.setUserId(row['user_id']);
			// Names may be present when joining; set if available
			if (row['user_name'] !== undefined) {
				warning.setUserName(row['user_name']);
			}
			if (row['discord_id'] !== undefined) {
				warning.setDiscordId(row['discord_id']);
			}
			if (row['user_avatar'] !== undefined) {
				warning.setUserAvatar(row['user_avatar']);
			}
			if (row['moderator_name'] !== undefined) {
				warning.setModeratorName(row['moderator_name']);
			}
			if (row['reporter_name'] !== undefined) {
				warning.setReporterName(row['reporter_name']);
			}
			warning.setTimestamp(row['timestamp']);
			warning.setRulesBroken(row['rules_broken']);
			warning.setViolatingContent(row['violating_content']);
			warning.setActionsTaken(row['actions_taken']);
			warning.setPointsAdded(row['points_added']);
			warning.setNewPointTotal(row['new_point_total']);
			warning.setModeratorNotes(row['moderator_notes']);
			warnings.push(warning);
		}

		return warnings;
	}
}

module.exports = {
	DatabaseManager,
};
