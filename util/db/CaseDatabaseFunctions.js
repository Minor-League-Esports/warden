const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager:Case');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const Case = require('../entity/Case');
const User = require('../entity/User');

/**
 * Retrieves a Case by ID with linked reports, warnings (with punishments), and standalone punishments
 * @param {number} caseId
 * @returns {Promise<Case>}
 */
async function getCaseById(caseId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	try {
		// Load case core + related users
		const caseRes = await this._queryFile('queries/get/case/getCaseById_case.sql', [caseId]);

		if (!caseRes.rows || caseRes.rows.length === 0) {
			throw new Error('Case not found');
		}

		const cRow = caseRes.rows[0];
		const kase = new Case();
		kase.setCaseId(cRow['case_id']);
		kase.setCreatorId(cRow['creator_id']);
		kase.setSubjectId(cRow['subject_id']);
		kase.setModeratorId(cRow['moderator_id']);
		kase.setStatus(cRow['status']);
		kase.setCreatedAt(cRow['created_at']);
		kase.setClosedAt(cRow['closed_at']);
		kase.setModeratorNotes(cRow['notes']);
		kase.setCaseSummaryLink(cRow['case_summary_link']);
		kase.setCaseLink(cRow['case_link']);
		kase.setCaseThreadLink(cRow['case_thread_link']);

		// Attach user objects if present (User has no constructor args, must use setters)
		const buildUser = (id, discordId, avatar, name, mleId) => {
			const u = new User();
			u.setUserId(id);
			u.setDiscordId(discordId);
			u.setDiscordAvatar(avatar);
			u.setUserName(name);
			u.setMleId(mleId);
			return u;
		};

		if (cRow['cre_id']) {
			kase.setCreator(
				buildUser(cRow['cre_id'], cRow['cre_discord_id'], cRow['cre_avatar'], cRow['cre_name'], cRow['cre_mle_id']),
			);
		}
		if (cRow['sub_id']) {
			kase.setSubjectUser(
				buildUser(cRow['sub_id'], cRow['sub_discord_id'], cRow['sub_avatar'], cRow['sub_name'], cRow['sub_mle_id']),
			);
		}
		if (cRow['mod_id']) {
			kase.setModerator(
				buildUser(cRow['mod_id'], cRow['mod_discord_id'], cRow['mod_avatar'], cRow['mod_name'], cRow['mod_mle_id']),
			);
		}

		// Reports in case
		const repRes = await this._queryFile('queries/get/case/getCaseById_reports.sql', [caseId]);
		const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(repRes);
		reports.forEach((r) => r.setCase(kase));

		// Warnings in case
		const warnRes = await this._queryFile('queries/get/case/getCaseById_warnings.sql', [caseId]);
		const warnings = globalThis.databaseResponseParser.parseDatabaseWarningResponse(warnRes);
		warnings.forEach((w) => w.setCase(kase));

		// Punishments in case, split between those tied to one of the warnings above and truly standalone ones
		const punRes = await this._queryFile('queries/get/case/getCaseById_punishments.sql', [caseId]);
		const casePunishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(punRes);
		casePunishments.forEach((p) => p.setCase(kase));

		const punishmentsByWarningId = new Map();
		const standalonePunishments = [];
		for (const punishment of casePunishments) {
			if (punishment.getWarningId()) {
				if (!punishmentsByWarningId.has(punishment.getWarningId())) {
					punishmentsByWarningId.set(punishment.getWarningId(), []);
				}
				punishmentsByWarningId.get(punishment.getWarningId()).push(punishment);
			} else {
				standalonePunishments.push(punishment);
			}
		}
		warnings.forEach((w) => w.setPunishments(punishmentsByWarningId.get(w.getWarningId()) ?? []));

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
 * Creates a Case row
 * @param {String} creatorId DB user_id of the reporter/creator
 * @param {String} subjectId DB user_id of the target user
 * @param {String} status Case status (e.g., 'open','closed')
 * @param {number|Date|string} createdAt Timestamp (default now)
 * @param {number|null} moderatorId Owning moderator (nullable)
 * @param {string|null} notes Notes (nullable)
 * @returns {Promise<Case>}
 */
async function createCase(
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
	return this.getCaseById(cases[0].getCaseId());
}

/**
 * Updates an existing case object and returns it
 *
 * @param {String} caseId The case's Database ID
 * @param {Object} fields An object containing fields to update (e.g., { status: 'CLOSED', moderator_id: 5 })
 * @returns {Promise<Case>} A promise to return the updated Case object
 */
async function updateCase(caseId, fields) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	if (!caseId || !fields || Object.keys(fields).length === 0) {
		throw new Error('caseId and at least one field are required to update a case');
	}

	// Build dynamic UPDATE statement safely
	const setClauses = Object.keys(fields)
		.map((key, idx) => `${key} = $${idx + 2}`)
		.join(', ');
	const values = [caseId, ...Object.values(fields)];

	const res = await this._pool.query(
		`UPDATE Cases
                SET ${setClauses}
                WHERE case_id = $1
                RETURNING *`,
		values,
	);

	const cases = globalThis.databaseResponseParser.parseDatabaseCaseResponse(res);
	if (cases.length !== 1) throw new Error('Failed to update case');
	logger.info(`Updated case with case_id ${caseId}: ` + JSON.stringify(fields));
	return this.getCaseById(caseId);
}

/**
 * Assigns a moderator to a case, cascading the assignment to every report attached to it
 *
 * @param {String} caseId The case's Database ID
 * @param {String} moderatorId DB user_id of the moderator claiming the case
 * @returns {Promise<Case>} A promise to return the updated Case object
 */
async function claimCase(caseId, moderatorId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const kase = await this.updateCase(caseId, { moderator_id: moderatorId });
	await this._pool.query('UPDATE Reports SET moderator_id = $1 WHERE case_id = $2', [moderatorId, caseId]);
	logger.info(`Case ${caseId} claimed by moderator ${moderatorId}; cascaded to attached reports`);
	return kase;
}

/**
 * Gets all cases in the database.
 *
 * @returns {Promise<Case[]>} A promise to return all cases
 */
async function getAllCases() {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/case/getAllCases.sql', []);
	const cases = [];
	for (const row of res.rows || []) {
		cases.push(await this.getCaseById(row.case_id));
	}
	return cases;
}

/**
 * Gets all cases for a user, including cases without warnings or punishments.
 *
 * @param {String} userId The user's Database ID
 * @returns {Promise<Case[]>} A promise to return the user's cases
 */
async function getCasesBySubjectId(userId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/case/getCasesBySubjectId.sql', [userId]);
	const cases = [];
	for (const row of res.rows || []) {
		cases.push(await this.getCaseById(row.case_id));
	}
	return cases;
}

/**
 * Attach an existing report to a case
 *
 * @param {String} reportId The ID of the report to attach
 * @param {String} caseId The ID of the case to attach the report to
 */
async function attachReportToCase(reportId, caseId) {
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
async function attachWarningToCase(warningId, caseId) {
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
async function attachPunishmentToCase(punishmentId, caseId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}
	await this._queryFile('queries/attach/attachPunishmentToCase.sql', [caseId, punishmentId]);
}

module.exports = {
	getCaseById,
	createCase,
	updateCase,
	claimCase,
	getAllCases,
	getCasesBySubjectId,
	attachReportToCase,
	attachWarningToCase,
	attachPunishmentToCase,
};
