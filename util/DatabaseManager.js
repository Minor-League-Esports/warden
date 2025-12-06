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
		return new Promise((resolve, reject) => {
			this._client
				.connect()
				.then(async () => {
					// Remove destructive table drop unless required
					// await this._client.query('DROP TABLE Users');

					await this._client.query(
						`CREATE TABLE IF NOT EXISTS Users (
                            user_id SERIAL PRIMARY KEY,
                            discord_id VARCHAR(20) NOT NULL,
                            user_name VARCHAR(64) NOT NULL
                        )`,
					);

					await this._client.query(
						`CREATE TABLE IF NOT EXISTS Warnings (
                            warning_id SERIAL PRIMARY KEY,
                            user_id INT REFERENCES Users(user_id),
                            moderator_id INT REFERENCES Users(user_id),
                            reporter_id INT REFERENCES Users(user_id),
                            timestamptz TIMESTAMPTZ NOT NULL,
                            private_reason VARCHAR(4000) NOT NULL,
                            public_reason VARCHAR(4000) NOT NULL,
                            points_added INT NOT NULL,
                            is_ban BOOLEAN NOT NULL
                        )`,
					);

					// Prepare parameterized statements
					await this._client.query(`
                        PREPARE get_warnings_by_user_id (int) AS
                        SELECT * FROM Warnings
                        WHERE user_id = $1
                        ORDER BY timestamptz DESC
                    `);
					await this._client.query(`
                        PREPARE get_user_id_by_discord_id (text) AS
                        SELECT * FROM Users
                        WHERE discord_id = $1
                        LIMIT 1
                    `);

					this._status = 'success';
					logger.debug('Initialized the database connection');
					resolve();
				})
				.catch((error) => {
					logger.error('DB Connection error!');
					logger.error(error);
					this._status = 'failed';
					reject(error);
				});
		});
	}

	/**
	 * Gets a user's warnings
	 *
	 * @param {String} userId The user's Discord ID
	 * @returns {Promise<Warning[]>} A promise to return an array of Warning objects
	 */
	async getWarnings(userId) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query('EXECUTE get_user_id_by_discord_id($1)', [userId])
				.then((result) => {
					const user = this.parseDatabaseUserResponse(result);
					if (user === null) return resolve([]);

					const dbUserId = user.getUserId();
					return this._client.query('EXECUTE get_warnings_by_user_id($1)', [dbUserId]);
				})
				.then((warningResult) => {
					return resolve(this.parseDatabaseWarningResponse(warningResult));
				})
				.catch((error) => {
					logger.error('Error getting warnings/user!');
					logger.error(error);
					return reject('Error getting warnings');
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
		logger.debug('Database response');
		logger.debug(rows);

		if (rows.length === 0) {
			return null;
		}

		const userRow = rows[0];
		const userId = userRow['user_id'];
		const discordId = userRow['discord_id'];
		const userName = userRow['user_name'];

		const user = new User(userId, discordId, userName);

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
		logger.debug('Database response');
		logger.debug(rows);

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
			warning.setIsBan(row['is_ban']);
			warnings.push(warning);
		}

		return warnings;
	}
}

module.exports = {
	DatabaseManager,
};
