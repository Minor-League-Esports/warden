const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager');
const { database, logLevel } = require('../config.json');
logger.level = logLevel;

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const Warning = require('./entity/Warning');
const User = require('./entity/User');
const Case = require('./entity/Case');
const { calculateCurrentPoints } = require('./UtilFunctions');

/**
 * Class for database CRUD operations
 */
class DatabaseManager {
	constructor() {
		this._status = 'init';
		this._sqlCache = new Map();
		this._client = new Client({
			user: database['username'],
			password: database['password'],
			host: database['hostname'],
			port: database['port'],
			database: database['database'],
			ssl: {
				rejectUnauthorized: true,
				// Only pin a custom CA if configured; otherwise trust Node's default root store
				// (needed for publicly-issued certs, e.g. Let's Encrypt)
				...(database['caCertPath'] ? { ca: fs.readFileSync(database['caCertPath']).toString() } : {}),
			},
		});
	}

	_loadSql(relativePath) {
		const fullPath = path.join(__dirname, '..', 'sql', relativePath);
		const cached = this._sqlCache.get(fullPath);
		if (cached) return cached;
		const sql = fs.readFileSync(fullPath, 'utf8');
		this._sqlCache.set(fullPath, sql);
		return sql;
	}

	async _queryFile(relativePath, params = []) {
		const sql = this._loadSql(relativePath);
		return this._client.query(sql, params);
	}

	/**
	 * Initializes the database connection
	 * @param None
	 * @returns {Promise<boolean>} A promise to initialize the connection
	 */
	async init() {
		// Sets status to 'success' on success and 'failed' on fail
		await this._client.connect();

		// Drop existing tables for fresh start (development only)
		// await this._client.query('DROP TABLE IF EXISTS Punishments CASCADE');
		// await this._client.query('DROP TABLE IF EXISTS Warnings CASCADE');
		// await this._client.query('DROP TABLE IF EXISTS Reports CASCADE');
		// await this._client.query('DROP TABLE IF EXISTS Cases CASCADE');

		await this._queryFile('init/Users.sql');

		// New: Cases table to group reports and resulting actions
		await this._queryFile('init/Cases.sql');

		await this._queryFile('init/Reports.sql');

		await this._queryFile('init/Punishments.sql');

		await this._queryFile('init/Warnings.sql');

		// New: Add supporting indexes
		await this._queryFile('init/indexes.sql');

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
				.query(this._loadSql('queries/get/getUsersWithCurrentPointsAtOrAbove.sql'))
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
				.query(this._loadSql('queries/get/getCurrentlyBannedUsers.sql'))
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
			const caseRes = await this._queryFile('queries/get/getCaseById_case.sql', [caseId]);

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
			const repRes = await this._queryFile('queries/get/getCaseById_reports.sql', [caseId]);
			const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(repRes);
			reports.forEach((r) => r.setCase(kase));

			// Warnings in case (with punishments via join)
			const warnRes = await this._queryFile('queries/get/getCaseById_warnings.sql', [caseId]);
			const warnings = globalThis.databaseResponseParser.parseDatabaseWarningResponse(warnRes);
			warnings.forEach((w) => {
				w.setCase(kase);
				(w.getPunishments() || []).forEach((p) => p.setCase(kase));
			});

			// Standalone punishments in case
			const punRes = await this._queryFile('queries/get/getCaseById_punishments.sql', [caseId]);
			const standalonePunishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(punRes);
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
	 * Creates a new user object and returns it
	 * Updates name and avatar if already exists
	 *
	 * @param {String} userId The user's Discord ID
	 * @param {String} userName The user's Discord username
	 * @param {String|null} mleId The user's MLE ID (optional)
	 * @param {String|null} discordAvatar The user's Discord avatar URL (optional)
	 * @returns {Object} An Object with {user, action, ?reason}
	 */
	async createUser(discordId, userName, mleId = null, discordAvatar = null) {
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
			let updateAvatar = true;
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
				if (updated.length !== 1) throw new Error('Failed to update user');
				logger.info(`Updated user ${user.getUserId()} with new name and avatar.`);
				return {
					user: updated[0],
					action: 'updated',
					reason: 'discord_id existed; updated name and avatar',
				};
			} else if (updateName) {
				const updated = await this.updateUser(user.getUserId(), { user_name: userName });
				if (updated.length !== 1) throw new Error('Failed to update user');
				logger.info(`Updated user ${user.getUserId()} with new name.`);
				return {
					user: updated[0],
					action: 'updated',
					reason: 'discord_id existed; updated name',
				};
			} else if (updateAvatar) {
				const updated = await this.updateUser(user.getUserId(), { discord_avatar: discordAvatar });
				if (updated.length !== 1) throw new Error('Failed to update user');
				logger.info(`Updated user ${user.getUserId()} with new avatar.`);
				return {
					user: updated[0],
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
	 * Creates a Case row
	 * @param {String} creatorId DB user_id of the reporter/creator
	 * @param {String} subjectId DB user_id of the target user
	 * @param {String} status Case status (e.g., 'open','closed')
	 * @param {number|Date|string} createdAt Timestamp (default now)
	 * @param {number|null} moderatorId Owning moderator (nullable)
	 * @param {string|null} notes Notes (nullable)
	 * @returns {Promise<Case>}
	 */
	async createCase(
		creatorId,
		subjectId,
		status = 'OPEN',
		createdAt = new Date().toISOString(),
		moderatorId = null,
		notes = null,
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		const res = await this._queryFile('queries/insert/insertCase.sql', [
			creatorId,
			subjectId,
			moderatorId,
			status,
			createdAt,
			notes,
		]);

		const cases = globalThis.databaseResponseParser.parseDatabaseCaseResponse(res);
		if (cases.length !== 1) throw new Error('Failed to create case');
		logger.info(`Created case ${cases[0].getCaseId()} for subject ${subjectId}`);
		return cases[0];
	}

	/**
	 * Creates a new warning for a user
	 *
	 * @param {String} subjectId DB ID of the user being warned
	 * @param {String} moderatorId DB ID of the moderator issuing the warning
	 * @param {String} rulesBroken The rules broken by the user
	 * @param {String} violatingContent The content that violated the rules
	 * @param {Number} pointsAdded Number of points added by this warning
	 * @param {String} moderatorNotes Private notes for moderator reference (optional)
	 * @param {String} timestamp Optional timestamp; defaults to now (ex 2025-12-12 20:23:22.611 -0600)
	 * @param {String} caseId DB ID of the Case the warning is associated with (optional)
	 * @returns {Warning} The newly created warning object
	 */
	async createWarning(
		subjectId,
		moderatorId,
		rulesBroken,
		violatingContent,
		pointsAdded,
		moderatorNotes = null,
		timestamp = new Date().toISOString(),
		caseId = null,
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		// Get existing warnings to compute current points at time of warn
		const existingWarnings = await this.getWarnings(subjectId);
		const currentPoints = calculateCurrentPoints(existingWarnings, timestamp);
		const newPointTotal = currentPoints + (pointsAdded || 0);

		const res = await this._queryFile('queries/insert/insertWarning.sql', [
			subjectId,
			moderatorId,
			caseId,
			timestamp,
			rulesBroken,
			violatingContent,
			pointsAdded,
			newPointTotal,
			moderatorNotes,
		]);

		const warnings = globalThis.databaseResponseParser.parseDatabaseWarningResponse(res);
		if (warnings.length !== 1) throw new Error('Failed to create warning');
		logger.info(`Created warning ${warnings[0].getWarningId()} for user ${subjectId}`);
		return warnings[0];
	}

	/**
	 * Creates a new Punishment object
	 *
	 * @param {String} subjectId DB ID of the user getting the punishment
	 * @param {String} moderatorId DB ID of the moderator who executed the punishment
	 * @param {String} punishmentType Type of punishment (mute, ban, etc)
	 * @param {Number} punishmentDuration How long the punishment is for (mutes in days, suspensions in weeks)
	 * @param {String} caseId DB ID of the associated case
	 * @param {String} timestamp ISO timestamp of the punishment (defaults to now)
	 * @returns {Promise<Punishment>} A promise with the created punishment
	 */
	async createPunishment(
		subjectId,
		moderatorId,
		punishmentType,
		punishmentDuration = null,
		caseId = null,
		timestamp = new Date().toISOString(),
	) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		// Create the punishment row
		const res = await this._queryFile('queries/insert/insertPunishment.sql', [
			subjectId,
			moderatorId,
			caseId,
			timestamp,
			punishmentType,
			punishmentDuration,
		]);

		const punishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(res);
		if (punishments.length !== 1) throw new Error('Failed to create punishment');
		logger.info(`Created punishment ${punishments[0].getPunishmentId()} for user ${subjectId}`);
		return punishments[0];
	}

	/**
	 * Creates a new Report object
	 *
	 * @param {String} subjectId DB ID of the user being reported
	 * @param {String} reporterId DB ID of the user making the report
	 * @param {String} reportReason User description of the report
	 * @param {String} evidence Evidence provided by the user
	 * @param {String} timestamp ISO timestamp of the punishment (defaults to now)
	 * @returns {Promise<Report>} A promise with the created report
	 */
	async createReport(subjectId, reporterId, reportReason, evidence = null, timestamp = new Date().toISOString()) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		// Create the report row
		const res = await this._queryFile('queries/insert/insertReport.sql', [
			subjectId,
			reporterId,
			timestamp,
			reportReason,
			evidence,
			'OPEN',
		]);

		const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(res);
		if (reports.length !== 1) throw new Error('Failed to create report');
		logger.info(`Created report ${reports[0].getReportId()} by ${reporterId} against user ${subjectId}`);
		return reports[0];
	}

	/**
	 * Gets a user object.
	 *
	 * @param {String} identifier The user's identifier (name, mle id, db id, etc)
	 * @returns {Promise<User|null>} A promise to return the User object (may be null)
	 */
	async getUserByIdentifier(identifier, type) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		const res = await this._queryFile(`queries/get/user/getUserByIdentifier_${type}.sql`, [identifier]);
		const users = globalThis.databaseResponseParser.parseDatabaseUserResponse(res);
		if (users.length !== 1) return null;
		return users[0];
	}

	/**
	 * Gets reports by user ID and type.
	 *
	 * @param {String} userId The DB ID of the user being searched
	 * @param {String} userType Type of user to search by ('subject', 'reporter', or 'moderator')
	 */
	async getReportsByUserId(userId, userType) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		if (!['subject', 'reporter', 'moderator'].includes(userType)) {
			throw new Error('Invalid userType specified. Must be "subject", "reporter", or "moderator".');
		}

		const res = await this._queryFile(
			`queries/get/report/getReportsBy${userType.charAt(0).toUpperCase() + userType.slice(1)}Id.sql`,
			[userId],
		);
		const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(res);
		return reports;
	}

	/**
	 * Gets a report by its ID.
	 *
	 * @param {String} reportId The ID of the report to retrieve
	 * @returns {Promise<Report|null>} A promise to return the Report object (may be null)
	 */
	async getReportById(reportId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		const res = await this._queryFile('queries/get/report/getReportById.sql', [reportId]);
		const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(res);
		if (reports.length !== 1) return null;
		return reports[0];
	}

	/**
	 * Gets a user's warnings
	 *
	 * @param {String} userId The user's Database ID
	 * @param {Number|null} limit Optional limit on number of warnings to return
	 * @returns {Promise<Warning[]>} A promise to return an array of Warning objects
	 */
	async getWarnings(userId, limit = null) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		const res = await this._queryFile('queries/get/getWarnings.sql', [userId]);
		let warnings = globalThis.databaseResponseParser.parseDatabaseWarningResponse(res);
		if (limit && Number.isInteger(limit)) {
			warnings = warnings.slice(0, limit);
		}
		return warnings;
	}

	/**
	 * Updates an existing user object and returns it
	 *
	 * @param {String} userId The user's Database ID
	 * @param {Object} fields An object containing fields to update (e.g., { user_name: 'NewName', discord_avatar: 'NewAvatarURL' })
	 * @returns {Promise<User>} A promise to return the updated User object
	 */
	async updateUser(userId, fields) {
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

		const res = await this._client.query(
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
	 * Updates an existing report object and returns it
	 *
	 * @param {String} reportId The report's Database ID
	 * @param {Object} fields An object containing fields to update (e.g., { status: 'CLOSED', moderator_notes: 'Reviewed and closed' })
	 * @returns {Promise<Report>} A promise to return the updated Report object
	 */
	async updateReport(reportId, fields) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}

		if (!reportId || !fields || Object.keys(fields).length === 0) {
			throw new Error('reportId and at least one field are required to update a report');
		}

		// Build dynamic UPDATE statement safely
		const setClauses = Object.keys(fields)
			.map((key, idx) => `${key} = $${idx + 2}`)
			.join(', ');
		const values = [reportId, ...Object.values(fields)];

		const res = await this._client.query(
			`UPDATE Reports
                SET ${setClauses}
                WHERE report_id = $1
                RETURNING *`,
			values,
		);

		const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(res);
		if (reports.length !== 1) throw new Error('Failed to update report');
		logger.info(`Updated report with report_id ${reportId}: ` + JSON.stringify(fields));
		return reports[0];
	}

	/**
	 * Attach an existing report to a case
	 *
	 * @param {String} reportId The ID of the report to attach
	 * @param {String} caseId The ID of the case to attach the report to
	 */
	async attachReportToCase(reportId, caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		await this._queryFile('queries/attach/attachReportToCase.sql', [caseId, reportId]);
	}

	/**
	 * Attach an existing warning to a case
	 *
	 * @param {String} warningId The ID of the warning to attach
	 * @param {String} caseId The ID of the case to attach the warning to
	 */
	async attachWarningToCase(warningId, caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		await this._queryFile('queries/attach/attachWarningToCase.sql', [caseId, warningId]);
	}

	/**
	 * Attach an existing punishment to a case
	 *
	 * @param {String} punishmentId The ID of the punishment to attach
	 * @param {String} caseId The ID of the case to attach the punishment to
	 */
	async attachPunishmentToCase(punishmentId, caseId) {
		if (this._status !== 'success') {
			throw new Error('DB manager not initialized');
		}
		await this._queryFile('queries/attach/attachPunishmentToCase.sql', [caseId, punishmentId]);
	}
}

module.exports = {
	DatabaseManager,
};
