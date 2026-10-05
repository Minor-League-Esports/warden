const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager');
const { database, logLevel } = require('../config.json');
logger.level = logLevel;

const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Class for database CRUD operations
 */
class DatabaseManager {
	constructor() {
		this._status = 'init';
		this._sqlCache = new Map();
		this._pool = new Pool({
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
		this._pool.on('error', (error) => {
			logger.error('Unexpected PostgreSQL pool error:', error);
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
		return this._pool.query(sql, params);
	}

	/**
	 * Replaces each record's core case with the fully loaded case (users, reports, warnings, punishments).
	 * Records without a case are left alone; each distinct case is loaded once per call.
	 * @param {Array<Report|Warning|Punishment>} records Mutated in place
	 * @returns {Promise<Array>} The same records
	 */
	async _hydrateCases(records) {
		// Entity getCaseId() returns the display string 'N/A' when there is no case
		const caseIds = [...new Set(records.map((r) => r.getCaseId()).filter((id) => id != null && id !== 'N/A'))];
		if (caseIds.length === 0) return records;

		const cases = new Map(await Promise.all(caseIds.map(async (id) => [id, await this.getCaseById(id)])));
		for (const record of records) {
			const kase = cases.get(record.getCaseId());
			if (kase) record.setCase(kase);
		}
		return records;
	}

	/**
	 * Initializes the database connection
	 * @param None
	 * @returns {Promise<boolean>} A promise to initialize the connection
	 */
	async init() {
		// Sets status to 'success' on success and 'failed' on fail
		const client = await this._pool.connect();
		client.release();

		// Drop existing tables for fresh start (development only)
		// await this._pool.query('DROP TABLE IF EXISTS Punishments CASCADE');
		// await this._pool.query('DROP TABLE IF EXISTS Users CASCADE');
		// await this._pool.query('DROP TABLE IF EXISTS Warnings CASCADE');
		// await this._pool.query('DROP TABLE IF EXISTS Reports CASCADE');
		// await this._pool.query('DROP TABLE IF EXISTS Cases CASCADE');

		await this._queryFile('init/Users.sql');

		// New: Cases table to group reports and resulting actions
		await this._queryFile('init/Cases.sql');

		await this._queryFile('init/Reports.sql');

		await this._queryFile('init/Warnings.sql');

		await this._queryFile('init/Punishments.sql');

		// New: Add supporting indexes
		await this._queryFile('init/indexes.sql');

		this._status = 'success';
		logger.debug('Initialized the database connection');
	}
}

// Domain-specific CRUD methods live in ./db and are mixed onto the prototype to keep this file manageable
Object.assign(DatabaseManager.prototype, require('./db/UserDatabaseFunctions'));
Object.assign(DatabaseManager.prototype, require('./db/CaseDatabaseFunctions'));
Object.assign(DatabaseManager.prototype, require('./db/ReportDatabaseFunctions'));
Object.assign(DatabaseManager.prototype, require('./db/WarningDatabaseFunctions'));
Object.assign(DatabaseManager.prototype, require('./db/PunishmentDatabaseFunctions'));

module.exports = {
	DatabaseManager,
};
