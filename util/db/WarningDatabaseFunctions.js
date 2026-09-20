const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager:Warning');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const Warning = require('../entity/Warning');
const User = require('../entity/User');
const { calculateCurrentPoints } = require('../UtilFunctions');

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
async function createWarning(
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
 * Gets a user's warnings
 *
 * @param {String} userId The user's Database ID
 * @param {Number|null} limit Optional limit on number of warnings to return
 * @returns {Promise<Warning[]>} A promise to return an array of Warning objects
 */
async function getWarnings(userId, limit = null) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/getWarnings.sql', [userId]);
	let warnings = globalThis.databaseResponseParser.parseDatabaseWarningResponse(res);
	if (limit && Number.isInteger(limit)) {
		warnings = warnings.slice(0, limit);
	}
	await this._attachPunishmentsToWarnings(warnings);
	return warnings;
}

/**
 * Fetches and attaches punishments to their originating warnings (mutates the given warnings in place)
 *
 * @param {Warning[]} warnings
 */
async function _attachPunishmentsToWarnings(warnings) {
	const warningIds = warnings.map((w) => w.getWarningId()).filter((id) => id != null);
	if (warningIds.length === 0) return;

	const res = await this._queryFile('queries/get/getPunishmentsByWarningIds.sql', [warningIds]);
	const punishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(res);

	const punishmentsByWarningId = new Map();
	for (const punishment of punishments) {
		const key = punishment.getWarningId();
		if (!punishmentsByWarningId.has(key)) punishmentsByWarningId.set(key, []);
		punishmentsByWarningId.get(key).push(punishment);
	}

	for (const warning of warnings) {
		warning.setPunishments(punishmentsByWarningId.get(warning.getWarningId()) ?? []);
	}
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
async function getUsersWithCurrentPointsAtOrAbove(threshold = 3, asOf = new Date().toISOString()) {
	return new Promise((resolve, reject) => {
		if (this._status !== 'success') {
			return reject('DB manager not initialized');
		}

		// Fetch all users with their warnings in one pass
		this._pool
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

module.exports = {
	createWarning,
	getWarnings,
	_attachPunishmentsToWarnings,
	getUsersWithCurrentPointsAtOrAbove,
};
