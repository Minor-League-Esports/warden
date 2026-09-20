const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager:Report');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

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
async function createReport(
	subjectId,
	reporterId,
	reportReason,
	evidence = null,
	timestamp = new Date().toISOString(),
) {
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
 * Gets all reports from the database.
 *
 * @returns {Promise<Report[]>} A promise to return an array of Report objects
 */
async function getAllReports() {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/report/getAllReports.sql', []);
	const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(res);
	return reports;
}

/**
 * Gets reports by user ID and type.
 *
 * @param {String} userId The DB ID of the user being searched
 * @param {String} userType Type of user to search by ('subject', 'reporter', or 'moderator')
 */
async function getReportsByUserId(userId, userType) {
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
async function getReportById(reportId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/report/getReportById.sql', [reportId]);
	const reports = globalThis.databaseResponseParser.parseDatabaseReportResponse(res);
	if (reports.length !== 1) return null;
	return reports[0];
}

/**
 * Updates an existing report object and returns it
 *
 * @param {String} reportId The report's Database ID
 * @param {Object} fields An object containing fields to update (e.g., { status: 'CLOSED', moderator_notes: 'Reviewed and closed' })
 * @returns {Promise<Report>} A promise to return the updated Report object
 */
async function updateReport(reportId, fields) {
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

	const res = await this._pool.query(
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

module.exports = {
	createReport,
	getAllReports,
	getReportsByUserId,
	getReportById,
	updateReport,
};
