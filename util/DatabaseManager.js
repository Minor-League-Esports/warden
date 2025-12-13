const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager');
const { database, logLevel } = require('../config.json');
logger.level = logLevel;

const { Client } = require('pg');
const Warning = require('./entity/Warning');
const User = require('./entity/User');

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
                discord_id VARCHAR(20) NOT NULL UNIQUE,
                discord_avatar VARCHAR(255),
                user_name VARCHAR(64) NOT NULL,
                mle_id VARCHAR(20)
            )`,
		);

		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Warnings (
                warning_id SERIAL PRIMARY KEY,
                user_id INT REFERENCES Users(user_id) NOT NULL,
                moderator_id INT REFERENCES Users(user_id) NOT NULL,
                reporter_id INT REFERENCES Users(user_id),
                timestamp TIMESTAMPTZ NOT NULL,
                private_reason VARCHAR(4000) NOT NULL,
                public_reason VARCHAR(4000) NOT NULL,
                points_added INT NOT NULL
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
	 * Gets a user object
	 *
	 * @param {String} userId The user's Discord ID
	 * @returns {Promise<User>} A promise to return the User object
	 */
	async getUserByDiscordId(userId) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query(
					`SELECT user_id, discord_id, discord_avatar, user_name, mle_id 
                    FROM Users 
                    WHERE discord_id = $1 
                    LIMIT 1`,
					[userId],
				)
				.then((result) => {
					const user = this.parseDatabaseUserResponse(result);
					if (user === null) return reject('User not found');
					this.getWarnings(user.getUserId())
						.then((warnings) => {
							user.setWarnings(warnings);
							return resolve(user);
						})
						.catch((error) => {
							logger.error('Error getting user warnings!');
							logger.error(error);
							return reject('Error getting user warnings');
						});
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
	 * @returns {Promise<User>} A promise to return the newly created User object
	 */
	async createUser(discordId, userName, mleId = null) {
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
						// If exists, update name only if different
						const currentName = existing.rows[0].user_name;
						if (currentName !== userName) {
							const updateRes = await this._client.query(
								`UPDATE Users
                                 SET user_name = $2
                                 WHERE discord_id = $1
                                 RETURNING user_id, discord_id, discord_avatar, user_name, mle_id`,
								[discordId, userName],
							);
							const user = this.parseDatabaseUserResponse(updateRes);
							logger.debug(`Updated user name for discord_id ${discordId} from "${currentName}" to "${userName}"`);
							return resolve({
								user,
								action: 'updated',
								reason: 'discord_id existed; name updated to match dataset',
							});
						}
						const user = this.parseDatabaseUserResponse(existing);
						return resolve({
							user,
							action: 'unchanged',
							reason: 'discord_id already in use; name unchanged',
						});
					}

					// Insert new user
					return this._client
						.query(
							`INSERT INTO Users (discord_id, user_name, mle_id)
                             VALUES ($1, $2, $3)
                             RETURNING user_id, discord_id, discord_avatar, user_name, mle_id`,
							[discordId, userName, mleId],
						)
						.then((result) => {
							const user = this.parseDatabaseUserResponse(result);
							logger.debug(`Created new user with discord_id ${discordId} and user_name "${userName}"`);
							if (user === null) return reject('Failed to create user');
							resolve({
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
					`SELECT * FROM Warnings 
                    WHERE user_id = $1 
                    ORDER BY timestamp DESC`,
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
	 * @param {String} privateReason Reason for warning only visible to staff
	 * @param {String} publicReason Reason for warning visible to the user
	 * @param {Number} pointsAdded Number of points added by this warning
	 * @param {String} timestamp Optional timestamp; defaults to now (ex 2025-12-12 20:23:22.611 -0600)
	 * @returns {Promise<Warning>} A Promise to return the newly created warning object
	 */
	async createWarning(
		userId,
		moderatorId,
		reporterId,
		privateReason,
		publicReason,
		pointsAdded,
		timestamp = new Date().toISOString(),
	) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query(
					`INSERT INTO Warnings 
                (user_id, moderator_id, reporter_id, timestamp, private_reason, public_reason, points_added)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
					[userId, moderatorId, reporterId, timestamp, privateReason, publicReason, pointsAdded],
				)
				.then((result) => {
					const warnings = this.parseDatabaseWarningResponse(result);
					if (warnings.length === 0) {
						return reject('Failed to create warning');
					}
					resolve(warnings[0]);
				})
				.catch((error) => {
					logger.error('Error creating warning!');
					logger.error(error);
					return reject('Error creating warning');
				});
		});
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
			warning.setModeratorId(row['moderator_id']);
			warning.setTimestamp(row['timestamp']);
			warning.setPrivateReason(row['private_reason']);
			warning.setPublicReason(row['public_reason']);
			warning.setReporterId(row['reporter_id']);
			warning.setPointsAdded(row['points_added']);
			warnings.push(warning);
		}

		return warnings;
	}
}

module.exports = {
	DatabaseManager,
};
