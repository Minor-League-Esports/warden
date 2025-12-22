const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager');
const { database, logLevel } = require('../config.json');
logger.level = logLevel;

const { Client } = require('pg');
const Warning = require('./entity/Warning');
const User = require('./entity/User');
const Punishment = require('./entity/Punishment');
const Case = require('./entity/Case');
const { calculateCurrentPoints } = require('./UtilFunctions');
const Report = require('./entity/Report');

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
		// await this._client.query('DROP TABLE IF EXISTS WarningPunishments');
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

		// New: Cases table to group reports and resulting actions
		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Cases (
				case_id SERIAL PRIMARY KEY,
				creator_id INT REFERENCES Users(user_id),
				subject_user_id INT REFERENCES Users(user_id),
				moderator_id INT REFERENCES Users(user_id),
				status TEXT NOT NULL,
				created_at TIMESTAMPTZ NOT NULL,
				closed_at TIMESTAMPTZ,
				notes TEXT,
				custom_response TEXT
			)`,
		);

		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Reports (
				report_id SERIAL PRIMARY KEY,
				reporter_id INT REFERENCES Users(user_id) NOT NULL,
				user_id INT REFERENCES Users(user_id),
                moderator_id INT REFERENCES Users(user_id) NOT NULL,
				report_timestamp TIMESTAMPTZ NOT NULL,
                acknowledge_timestamp TIMESTAMPTZ NOT NULL,
                close_timestamp TIMESTAMPTZ NOT NULL,
                report_reason TEXT NOT NULL,
                report_evidence TEXT NOT NULL,
                status TEXT NOT NULL,
                moderator_notes TEXT,
                custom_response TEXT,
                case_id INT REFERENCES Cases(case_id)
			)`,
		);

		await this._client.query(
			`CREATE TABLE IF NOT EXISTS Punishments (
				punishment_id SERIAL PRIMARY KEY,
				user_id INT REFERENCES Users(user_id) NOT NULL,
				moderator_id INT REFERENCES Users(user_id) NOT NULL,
				timestamp TIMESTAMPTZ NOT NULL,
                punishment_type TEXT NOT NULL,
                punishment_duration INT,
                case_id INT REFERENCES Cases(case_id)
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
				new_point_total INT NOT NULL,
				moderator_notes TEXT,
				case_id INT REFERENCES Cases(case_id)
			)`,
		);

		// New: Add supporting indexes
		await this._client.query('CREATE INDEX IF NOT EXISTS idx_reports_case_id ON Reports(case_id)');
		await this._client.query('CREATE INDEX IF NOT EXISTS idx_warnings_case_id ON Warnings(case_id)');
		await this._client.query('CREATE INDEX IF NOT EXISTS idx_punishments_case_id ON Punishments(case_id)');

		this._status = 'success';
		logger.debug('Initialized the database connection');
	}

	/**
	 * Gets all users whose current mod points are at or above a threshold
	 * Computation uses in-memory decay logic via calculateCurrentPoints() at a given timestamp
	 * Single SQL query to fetch all users and their warnings, then grouped client-side
	 *
	 * @param {number} threshold Minimum points required (inclusive)
	 * @param {string|Date|number} asOf Timestamp to evaluate points at (default: now)
	 * @returns {Promise<Array<{ user: User, points: number }>>}
	 */
	async getUsersWithCurrentPointsAtOrAbove(threshold = 3, asOf = new Date().toISOString()) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			// Fetch all users with their warnings in one pass
			this._client
				.query(
					`WITH latest_ban AS (
						SELECT user_id, MAX(timestamp) AS last_ban_at
						FROM Punishments
						WHERE punishment_type = 'ban'
						GROUP BY user_id
					),
					latest_unban AS (
						SELECT user_id, MAX(timestamp) AS last_unban_at
						FROM Punishments
						WHERE punishment_type = 'unban'
						GROUP BY user_id
					),
					ban_status AS (
						SELECT u.user_id,
							CASE 
								WHEN lb.last_ban_at IS NOT NULL AND (lu.last_unban_at IS NULL OR lb.last_ban_at > lu.last_unban_at)
									THEN TRUE
								ELSE FALSE
							END AS is_banned
						FROM Users u
						LEFT JOIN latest_ban lb ON lb.user_id = u.user_id
						LEFT JOIN latest_unban lu ON lu.user_id = u.user_id
					)
					SELECT 
						u.user_id AS user_id,
						u.discord_id AS discord_id,
						u.discord_avatar AS discord_avatar,
						u.user_name AS user_name,
						u.mle_id AS mle_id,
						w.warning_id AS warning_id,
						w.timestamp AS timestamp,
						w.points_added AS points_added,
						bs.is_banned AS is_banned
					FROM Users u
					LEFT JOIN Warnings w ON w.user_id = u.user_id
					LEFT JOIN ban_status bs ON bs.user_id = u.user_id
					WHERE COALESCE(bs.is_banned, FALSE) = FALSE
					ORDER BY u.user_id ASC, w.timestamp ASC NULLS LAST`,
				)
				.then((result) => {
					const rows = result.rows || [];
					// Group by user_id
					const byUser = new Map();
					for (const row of rows) {
						let entry = byUser.get(row['user_id']);
						if (!entry) {
							const user = new User(
								row['user_id'],
								row['discord_id'],
								row['discord_avatar'],
								row['user_name'],
								row['mle_id'],
							);
							entry = { user, warnings: [] };
							byUser.set(row['user_id'], entry);
						}

						// Append warning summary if present
						if (row['warning_id'] != null) {
							const w = new Warning();
							w.setTimestamp(row['timestamp']);
							w.setPointsAdded(row['points_added']);
							entry.warnings.push(w);
						}
					}

					// Compute current points and filter
					const qualifying = [];
					for (const { user, warnings } of byUser.values()) {
						const pts = calculateCurrentPoints(warnings, asOf);
						if (pts >= threshold) {
							qualifying.push({ user, points: pts });
						}
					}

					resolve(qualifying);
				})
				.catch((error) => {
					logger.error('Error computing users at/above threshold!');
					logger.error(error);
					reject('Error computing users at/above threshold');
				});
		});
	}

	/**
	 * Returns all users that are currently banned.
	 * A user is considered banned if the latest 'ban' punishment timestamp
	 * is present and is newer than the latest 'unban' (or no unban exists).
	 * @returns {Promise<User[]>}
	 */
	async getCurrentlyBannedUsers() {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query(
					`WITH latest_ban AS (
						SELECT user_id, MAX(timestamp) AS last_ban_at
						FROM Punishments
						WHERE punishment_type = 'ban'
						GROUP BY user_id
					),
					latest_unban AS (
						SELECT user_id, MAX(timestamp) AS last_unban_at
						FROM Punishments
						WHERE punishment_type = 'unban'
						GROUP BY user_id
					),
					ban_status AS (
						SELECT u.user_id,
							CASE 
								WHEN lb.last_ban_at IS NOT NULL AND (lu.last_unban_at IS NULL OR lb.last_ban_at > lu.last_unban_at)
									THEN TRUE
								ELSE FALSE
							END AS is_banned
						FROM Users u
						LEFT JOIN latest_ban lb ON lb.user_id = u.user_id
						LEFT JOIN latest_unban lu ON lu.user_id = u.user_id
					)
					SELECT 
						u.user_id AS user_id,
						u.discord_id AS discord_id,
						u.discord_avatar AS discord_avatar,
						u.user_name AS user_name,
						u.mle_id AS mle_id
					FROM Users u
					JOIN ban_status bs ON bs.user_id = u.user_id
					WHERE bs.is_banned = TRUE
					ORDER BY u.user_name ASC`,
				)
				.then((result) => {
					const users = (result.rows || []).map(
						(row) =>
							new User(row['user_id'], row['discord_id'], row['discord_avatar'], row['user_name'], row['mle_id']),
					);
					resolve(users);
				})
				.catch((error) => {
					logger.error('Error fetching currently banned users!');
					logger.error(error);
					reject('Error fetching currently banned users');
				});
		});
	}

	/**
	 * Retrieves a Case by ID with linked reports, warnings (with punishments), and standalone punishments
	 * @param {number} caseId
	 * @returns {Promise<Case>}
	 */
	async getCaseById(caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		try {
			// Load case core + related users
			const caseRes = await this._client.query(
				`SELECT 
						c.case_id,
						c.creator_id,
						c.subject_user_id,
						c.moderator_id,
						c.status,
						c.created_at,
						c.closed_at,
						c.notes,
						c.custom_response,
						-- Creator
						u_cre.user_id AS cre_id,
						u_cre.discord_id AS cre_discord_id,
						u_cre.discord_avatar AS cre_avatar,
						u_cre.user_name AS cre_name,
						u_cre.mle_id AS cre_mle_id,
						-- Subject
						u_sub.user_id AS sub_id,
						u_sub.discord_id AS sub_discord_id,
						u_sub.discord_avatar AS sub_avatar,
						u_sub.user_name AS sub_name,
						u_sub.mle_id AS sub_mle_id,
						-- Moderator
						u_mod.user_id AS mod_id,
						u_mod.discord_id AS mod_discord_id,
						u_mod.discord_avatar AS mod_avatar,
						u_mod.user_name AS mod_name,
						u_mod.mle_id AS mod_mle_id
					FROM Cases c
					LEFT JOIN Users u_cre ON u_cre.user_id = c.creator_id
					LEFT JOIN Users u_sub ON u_sub.user_id = c.subject_user_id
					LEFT JOIN Users u_mod ON u_mod.user_id = c.moderator_id
					WHERE c.case_id = $1
					LIMIT 1`,
				[caseId],
			);

			if (!caseRes.rows || caseRes.rows.length === 0) {
				throw new Error('Case not found');
			}

			const cRow = caseRes.rows[0];
			const kase = new Case();
			kase.setCaseId(cRow['case_id']);
			kase.setStatus(cRow['status']);
			kase.setCreatedAt(cRow['created_at']);
			kase.setClosedAt(cRow['closed_at']);
			kase.setNotes(cRow['notes']);
			kase.setCustomResponse(cRow['custom_response']);

			// Attach user objects if present
			if (cRow['cre_id']) {
				kase.setCreator(
					new User(cRow['cre_id'], cRow['cre_discord_id'], cRow['cre_avatar'], cRow['cre_name'], cRow['cre_mle_id']),
				);
			}
			if (cRow['sub_id']) {
				kase.setSubjectUser(
					new User(cRow['sub_id'], cRow['sub_discord_id'], cRow['sub_avatar'], cRow['sub_name'], cRow['sub_mle_id']),
				);
			}
			if (cRow['mod_id']) {
				kase.setModerator(
					new User(cRow['mod_id'], cRow['mod_discord_id'], cRow['mod_avatar'], cRow['mod_name'], cRow['mod_mle_id']),
				);
			}

			// Reports in case
			const repRes = await this._client.query(
				`SELECT 
						r.report_id,
						r.reporter_id,
						r.user_id,
						r.moderator_id,
						r.report_timestamp,
						r.acknowledge_timestamp,
						r.close_timestamp,
						r.report_reason,
						r.report_evidence,
						r.status,
						r.moderator_notes,
						r.custom_response,
						-- Reporter
						u_rep.user_id AS u_rep_id,
						u_rep.discord_id AS u_rep_discord_id,
						u_rep.discord_avatar AS u_rep_avatar,
						u_rep.user_name AS u_rep_name,
						u_rep.mle_id AS u_rep_mle_id,
						-- Subject (reported)
						u_user.user_id AS u_user_id,
						u_user.discord_id AS u_user_discord_id,
						u_user.discord_avatar AS u_user_avatar,
						u_user.user_name AS u_user_name,
						u_user.mle_id AS u_user_mle_id,
						-- Moderator
						u_mod.user_id AS u_mod_id,
						u_mod.discord_id AS u_mod_discord_id,
						u_mod.discord_avatar AS u_mod_avatar,
						u_mod.user_name AS u_mod_name,
						u_mod.mle_id AS u_mod_mle_id
					FROM Reports r
					LEFT JOIN Users u_rep ON u_rep.user_id = r.reporter_id
					LEFT JOIN Users u_user ON u_user.user_id = r.user_id
					LEFT JOIN Users u_mod ON u_mod.user_id = r.moderator_id
					WHERE r.case_id = $1
					ORDER BY r.report_timestamp ASC`,
				[caseId],
			);
			const reports = this.parseDatabaseReportResponse(repRes);
			reports.forEach((r) => r.setCase(kase));

			// Warnings in case (with punishments via join)
			const warnRes = await this._client.query(
				`SELECT 
						w.warning_id,
						w.user_id,
						w.moderator_id,
						w.reporter_id,
						w.timestamp,
						w.rules_broken,
						w.violating_content,
						w.points_added,
						w.new_point_total,
						w.moderator_notes,
						-- Target user (warned)
						u_user.user_id AS u_user_id,
						u_user.discord_id AS u_user_discord_id,
						u_user.discord_avatar AS u_user_avatar,
						u_user.user_name AS u_user_name,
						u_user.mle_id AS u_user_mle_id,
						-- Moderator
						u_mod.user_id AS u_mod_id,
						u_mod.discord_id AS u_mod_discord_id,
						u_mod.discord_avatar AS u_mod_avatar,
						u_mod.user_name AS u_mod_name,
						u_mod.mle_id AS u_mod_mle_id,
						-- Reporter (nullable)
						u_rep.user_id AS u_rep_id,
						u_rep.discord_id AS u_rep_discord_id,
						u_rep.discord_avatar AS u_rep_avatar,
						u_rep.user_name AS u_rep_name,
						u_rep.mle_id AS u_rep_mle_id,
						-- Linked punishments (nullable)
						pun.punishment_id AS pun_id,
						pun.user_id AS pun_user_id,
						pun.moderator_id AS pun_moderator_id,
						pun.timestamp AS pun_timestamp,
						pun.punishment_type AS pun_type,
						pun.punishment_duration AS pun_duration
					FROM Warnings w
					LEFT JOIN Users u_user ON u_user.user_id = w.user_id
					LEFT JOIN Users u_mod ON u_mod.user_id = w.moderator_id
					LEFT JOIN Users u_rep ON u_rep.user_id = w.reporter_id
					LEFT JOIN WarningPunishments wp ON wp.warning_id = w.warning_id
					LEFT JOIN Punishments pun ON pun.punishment_id = wp.punishment_id
					WHERE w.case_id = $1
					ORDER BY w.timestamp DESC, pun.timestamp DESC NULLS LAST`,
				[caseId],
			);
			const warnings = this.parseDatabaseWarningResponse(warnRes);
			warnings.forEach((w) => {
				w.setCase(kase);
				(w.getPunishments() || []).forEach((p) => p.setCase(kase));
			});

			// Standalone punishments in case
			const punRes = await this._client.query(
				`SELECT 
						pun.punishment_id AS pun_id,
						pun.user_id AS pun_user_id,
						pun.moderator_id AS pun_moderator_id,
						pun.timestamp AS pun_timestamp,
						pun.punishment_type AS pun_type,
						pun.punishment_duration AS pun_duration,
						-- Target user (punished)
						u_user.user_id AS u_user_id,
						u_user.discord_id AS u_user_discord_id,
						u_user.discord_avatar AS u_user_avatar,
						u_user.user_name AS u_user_name,
						u_user.mle_id AS u_user_mle_id,
						-- Moderator
						u_mod.user_id AS u_mod_id,
						u_mod.discord_id AS u_mod_discord_id,
						u_mod.discord_avatar AS u_mod_avatar,
						u_mod.user_name AS u_mod_name,
						u_mod.mle_id AS u_mod_mle_id
					FROM Punishments pun
					JOIN Users u_user ON u_user.user_id = pun.user_id
					JOIN Users u_mod ON u_mod.user_id = pun.moderator_id
					LEFT JOIN WarningPunishments wp ON wp.punishment_id = pun.punishment_id
					WHERE pun.case_id = $1 AND wp.punishment_id IS NULL
					ORDER BY pun.timestamp DESC`,
				[caseId],
			);
			const standalonePunishments = this.parseDatabasePunishmentResponse(punRes);
			standalonePunishments.forEach((p) => p.setCase(kase));

			// Assemble and return
			kase.setReports(reports);
			kase.setWarnings(warnings);
			kase.setPunishments(standalonePunishments);
			return kase;
		} catch (error) {
			logger.error('Error getting case by ID!');
			logger.error(error);
			throw new Error('Error getting case by ID');
		}
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
	async getUserByDiscordId(userId, type = 'discord') {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			let whereClause;
			if (type === 'discord') {
				whereClause = 'u.discord_id = $1';
			} else if (type === 'mle') {
				whereClause = 'u.mle_id = $1';
			} else if (type === 'db') {
				whereClause = 'u.user_id = $1';
			} else {
				return reject('Invalid user ID type specified');
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
					WHERE ${whereClause}
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
	async getWarnings(userId, limit = null) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query(
					`SELECT 
						w.warning_id,
						w.user_id,
						w.moderator_id,
						w.reporter_id,
						w.timestamp,
						w.rules_broken,
						w.violating_content,
						w.points_added,
						w.new_point_total,
						w.moderator_notes,
						-- Target user (warned)
						u_user.user_id AS u_user_id,
						u_user.discord_id AS u_user_discord_id,
						u_user.discord_avatar AS u_user_avatar,
						u_user.user_name AS u_user_name,
						u_user.mle_id AS u_user_mle_id,
						-- Moderator
						u_mod.user_id AS u_mod_id,
						u_mod.discord_id AS u_mod_discord_id,
						u_mod.discord_avatar AS u_mod_avatar,
						u_mod.user_name AS u_mod_name,
						u_mod.mle_id AS u_mod_mle_id,
						-- Reporter (nullable)
						u_rep.user_id AS u_rep_id,
						u_rep.discord_id AS u_rep_discord_id,
						u_rep.discord_avatar AS u_rep_avatar,
						u_rep.user_name AS u_rep_name,
						u_rep.mle_id AS u_rep_mle_id,
						-- Linked punishments (nullable)
						pun.punishment_id AS pun_id,
						pun.user_id AS pun_user_id,
						pun.moderator_id AS pun_moderator_id,
						pun.timestamp AS pun_timestamp,
						pun.punishment_type AS pun_type,
						pun.punishment_duration AS pun_duration
					FROM Warnings w
					LEFT JOIN Users u_user ON u_user.user_id = w.user_id
					LEFT JOIN Users u_mod ON u_mod.user_id = w.moderator_id
					LEFT JOIN Users u_rep ON u_rep.user_id = w.reporter_id
					LEFT JOIN WarningPunishments wp ON wp.warning_id = w.warning_id
					LEFT JOIN Punishments pun ON pun.punishment_id = wp.punishment_id
					WHERE w.user_id = $1
					ORDER BY w.timestamp DESC, pun.timestamp DESC NULLS LAST
                    ${limit ? `LIMIT ${limit}` : ''}`,
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
	 * Gets a user's standalone punishments (not linked to any warning)
	 *
	 * @param {String} userId The user's Database ID
	 * @returns {Promise<Punishment[]>} A promise to return an array of Punishment objects
	 */
	async getStandalonePunishments(userId) {
		return new Promise((resolve, reject) => {
			if (this._status !== 'success') {
				return reject('DB manager not initialized');
			}

			this._client
				.query(
					`SELECT 
						pun.punishment_id AS pun_id,
						pun.user_id AS pun_user_id,
						pun.moderator_id AS pun_moderator_id,
						pun.timestamp AS pun_timestamp,
						pun.punishment_type AS pun_type,
						pun.punishment_duration AS pun_duration,
						-- Target user (punished)
						u_user.user_id AS u_user_id,
						u_user.discord_id AS u_user_discord_id,
						u_user.discord_avatar AS u_user_avatar,
						u_user.user_name AS u_user_name,
						u_user.mle_id AS u_user_mle_id,
						-- Moderator
						u_mod.user_id AS u_mod_id,
						u_mod.discord_id AS u_mod_discord_id,
						u_mod.discord_avatar AS u_mod_avatar,
						u_mod.user_name AS u_mod_name,
						u_mod.mle_id AS u_mod_mle_id
					FROM Punishments pun
					JOIN Users u_user ON u_user.user_id = pun.user_id
					JOIN Users u_mod ON u_mod.user_id = pun.moderator_id
					LEFT JOIN WarningPunishments wp ON wp.punishment_id = pun.punishment_id
					WHERE pun.user_id = $1 AND wp.punishment_id IS NULL
					ORDER BY pun.timestamp DESC`,
					[userId],
				)
				.then((punResult) => {
					return resolve(this.parseDatabasePunishmentResponse(punResult));
				})
				.catch((error) => {
					logger.error('Error getting standalone punishments!');
					logger.error(error);
					return reject('Error getting standalone punishments');
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
		moderatorNotes = null,
		timestamp = new Date().toISOString(),
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		try {
			// Get existing warnings to compute current points at time of warn
			const existingWarnings = await this.getWarnings(userId);
			const currentPoints = calculateCurrentPoints(existingWarnings, timestamp);
			const newPointTotal = currentPoints + (pointsAdded || 0);

			const result = await this._client.query(
				`INSERT INTO Warnings 
                (user_id, moderator_id, reporter_id, timestamp, rules_broken, violating_content, points_added, new_point_total, moderator_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
				[
					userId,
					moderatorId,
					reporterId,
					timestamp,
					rulesBroken,
					violatingContent,
					pointsAdded,
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

	async createPunishment(
		userId,
		moderatorId,
		punishmentType,
		punishmentDuration = null,
		timestamp = new Date().toISOString(),
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		try {
			// Create the punishment row and get the new ID
			const insertResult = await this._client.query(
				`INSERT INTO Punishments
				(user_id, moderator_id, timestamp, punishment_type, punishment_duration)
				VALUES ($1, $2, $3, $4, $5)
				RETURNING punishment_id`,
				[userId, moderatorId, timestamp, punishmentType, punishmentDuration],
			);

			if (!insertResult.rows || insertResult.rows.length === 0) {
				throw new Error('Failed to create punishment');
			}

			const createdPunishmentId = insertResult.rows[0]['punishment_id'];

			// Load full context (user + moderator) for the newly created punishment
			const joinedResult = await this._client.query(
				`SELECT 
					pun.punishment_id AS pun_id,
					pun.user_id AS pun_user_id,
					pun.moderator_id AS pun_moderator_id,
					pun.timestamp AS pun_timestamp,
					pun.punishment_type AS pun_type,
					pun.punishment_duration AS pun_duration,
					-- Target user (punished)
					u_user.user_id AS u_user_id,
					u_user.discord_id AS u_user_discord_id,
					u_user.discord_avatar AS u_user_avatar,
					u_user.user_name AS u_user_name,
					u_user.mle_id AS u_user_mle_id,
					-- Moderator
					u_mod.user_id AS u_mod_id,
					u_mod.discord_id AS u_mod_discord_id,
					u_mod.discord_avatar AS u_mod_avatar,
					u_mod.user_name AS u_mod_name,
					u_mod.mle_id AS u_mod_mle_id
				FROM Punishments pun
				JOIN Users u_user ON u_user.user_id = pun.user_id
				JOIN Users u_mod ON u_mod.user_id = pun.moderator_id
				WHERE pun.punishment_id = $1`,
				[createdPunishmentId],
			);

			const punishments = this.parseDatabasePunishmentResponse(joinedResult);
			if (!punishments || punishments.length === 0) {
				throw new Error('Failed to load created punishment');
			}
			return punishments[0];
		} catch (error) {
			logger.error('Error creating punishment!');
			logger.error(error);
			throw new Error('Error creating punishment');
		}
	}

	async createWarningPunishmentLink(warningId, punishmentId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		try {
			await this._client.query(
				`INSERT INTO WarningPunishments
                (warning_id, punishment_id)
                VALUES ($1, $2)`,
				[warningId, punishmentId],
			);
			logger.debug(`Linked punishment ID ${punishmentId} to warning ID ${warningId}`);
		} catch (error) {
			logger.error('Error linking warning and punishment!');
			logger.error(error);
			throw new Error('Error linking warning and punishment');
		}
	}

	/**
	 * Creates a Case row
	 * @param {number|null} creatorId DB user_id of the reporter/creator (nullable)
	 * @param {number|null} subjectUserId DB user_id of the target user (nullable)
	 * @param {string} status Case status (e.g., 'open','closed')
	 * @param {number|Date|string} createdAt Timestamp (default now)
	 * @param {number|null} moderatorId Owning moderator (nullable)
	 * @param {string|null} notes Notes (nullable)
	 * @param {string|null} customResponse Custom response (nullable)
	 * @returns {Promise<Case>}
	 */
	async createCase(
		creatorId = null,
		subjectUserId = null,
		status = 'open',
		createdAt = new Date().toISOString(),
		moderatorId = null,
		notes = null,
		customResponse = null,
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		try {
			const res = await this._client.query(
				`INSERT INTO Cases (creator_id, subject_user_id, moderator_id, status, created_at, closed_at, notes, custom_response)
				 VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
				 RETURNING *`,
				[creatorId, subjectUserId, moderatorId, status, createdAt, notes, customResponse],
			);

			const row = res.rows?.[0];
			if (!row) throw new Error('Failed to create case');

			const kase = new Case();
			kase.setCaseId(row['case_id']);
			kase.setStatus(row['status']);
			kase.setCreatedAt(row['created_at']);
			kase.setClosedAt(row['closed_at']);
			kase.setNotes(row['notes']);
			kase.setCustomResponse(row['custom_response']);
			// Subject/creator/moderator objects can be resolved by caller if needed
			return kase;
		} catch (error) {
			logger.error('Error creating case!');
			logger.error(error);
			throw new Error('Error creating case');
		}
	}

	/**
	 * Attach an existing report to a case
	 */
	async attachReportToCase(reportId, caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		await this._client.query('UPDATE Reports SET case_id = $1 WHERE report_id = $2', [caseId, reportId]);
	}

	/**
	 * Attach an existing warning to a case
	 */
	async attachWarningToCase(warningId, caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		await this._client.query('UPDATE Warnings SET case_id = $1 WHERE warning_id = $2', [caseId, warningId]);
	}

	/**
	 * Attach an existing punishment to a case
	 */
	async attachPunishmentToCase(punishmentId, caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		await this._client.query('UPDATE Punishments SET case_id = $1 WHERE punishment_id = $2', [caseId, punishmentId]);
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

		// Group rows by warning_id to aggregate punishments per warning
		const byId = new Map();

		for (const row of rows) {
			const wid = row['warning_id'];
			let entry = byId.get(wid);
			if (!entry) {
				// Build full User objects
				const warnedUser = new User(
					row['u_user_id'],
					row['u_user_discord_id'],
					row['u_user_avatar'],
					row['u_user_name'],
					row['u_user_mle_id'],
				);
				const moderatorUser = new User(
					row['u_mod_id'],
					row['u_mod_discord_id'],
					row['u_mod_avatar'],
					row['u_mod_name'],
					row['u_mod_mle_id'],
				);
				let reporterUser = null;
				if (row['u_rep_id']) {
					reporterUser = new User(
						row['u_rep_id'],
						row['u_rep_discord_id'],
						row['u_rep_avatar'],
						row['u_rep_name'],
						row['u_rep_mle_id'],
					);
				}

				const warning = new Warning();
				warning.setWarningId(wid);
				warning.setUser(warnedUser);
				warning.setModerator(moderatorUser);
				reporterUser ? warning.setReporter(reporterUser) : warning.setReporter(null);
				warning.setTimestamp(row['timestamp']);
				warning.setRulesBroken(row['rules_broken']);
				warning.setViolatingContent(row['violating_content']);
				warning.setPointsAdded(row['points_added']);
				warning.setNewPointTotal(row['new_point_total']);
				warning.setModeratorNotes(row['moderator_notes']);
				warning.setPunishments([]);

				entry = { warning };
				byId.set(wid, entry);
			}

			// Add punishment if present
			if (row['pun_id']) {
				const p = new Punishment();
				p.setPunishmentId(row['pun_id']);
				p.setType(row['pun_type']);
				p.setDuration(row['pun_duration']);
				p.setTimestamp(row['pun_timestamp']);
				// Attach context users (optional convenience)
				p.setUser(entry.warning.getUser());
				p.setModerator(entry.warning.getModerator());

				entry.warning.getPunishments().push(p);
			}
		}

		return Array.from(byId.values()).map((e) => e.warning);
	}

	/**
	 * Parses raw database data into an array of Punishments
	 *
	 * @param {*} punResult The raw DB data
	 * @returns {Punishment[]} The parsed Punishments
	 */
	parseDatabasePunishmentResponse(punResult) {
		const rows = punResult.rows;
		const punishments = [];
		for (const row of rows) {
			const p = new Punishment();
			p.setPunishmentId(row['pun_id']);
			p.setType(row['pun_type']);
			p.setDuration(row['pun_duration']);
			p.setTimestamp(row['pun_timestamp']);
			// Build user context
			const punishedUser = new User(
				row['u_user_id'],
				row['u_user_discord_id'],
				row['u_user_avatar'],
				row['u_user_name'],
				row['u_user_mle_id'],
			);
			const moderatorUser = new User(
				row['u_mod_id'],
				row['u_mod_discord_id'],
				row['u_mod_avatar'],
				row['u_mod_name'],
				row['u_mod_mle_id'],
			);
			p.setUser(punishedUser);
			p.setModerator(moderatorUser);
			punishments.push(p);
		}

		return punishments;
	}

	/**
	 * Parses raw database data into an array of Reports
	 * @param {*} reportResult The raw DB data
	 * @returns {Report[]} The parsed Reports
	 */
	parseDatabaseReportResponse(reportResult) {
		const rows = reportResult.rows || [];
		const reports = [];
		for (const row of rows) {
			const rep = new Report();
			rep.setReportId(row['report_id']);
			// Users
			let reporterUser = null;
			let subjectUser = null;
			let moderatorUser = null;
			if (row['u_rep_id']) {
				reporterUser = new User(
					row['u_rep_id'],
					row['u_rep_discord_id'],
					row['u_rep_avatar'],
					row['u_rep_name'],
					row['u_rep_mle_id'],
				);
			}
			if (row['u_user_id']) {
				subjectUser = new User(
					row['u_user_id'],
					row['u_user_discord_id'],
					row['u_user_avatar'],
					row['u_user_name'],
					row['u_user_mle_id'],
				);
			}
			if (row['u_mod_id']) {
				moderatorUser = new User(
					row['u_mod_id'],
					row['u_mod_discord_id'],
					row['u_mod_avatar'],
					row['u_mod_name'],
					row['u_mod_mle_id'],
				);
			}
			if (reporterUser) rep.setReporter(reporterUser);
			if (subjectUser) rep.setUser(subjectUser);
			if (moderatorUser) rep.setModerator(moderatorUser);

			rep.setReportTimestamp(row['report_timestamp']);
			rep.setAcknowledgeTimestamp(row['acknowledge_timestamp']);
			rep.setCloseTimestamp(row['close_timestamp']);
			rep.setReportReason(row['report_reason']);
			rep.setReportEvidence(row['report_evidence']);
			rep.setStatus(row['status']);
			rep.setModeratorNotes(row['moderator_notes']);
			rep.setCustomResponse(row['custom_response']);

			reports.push(rep);
		}
		return reports;
	}
}

module.exports = {
	DatabaseManager,
};
