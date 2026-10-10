const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseManager:Punishment');
const { logLevel } = require('../../config.json');
logger.level = logLevel;


/**
 * Creates a new Punishment object
 *
 * @param {String} subjectId DB ID of the user getting the punishment
 * @param {String} moderatorId DB ID of the moderator who executed the punishment
 * @param {String} punishmentType Type of punishment (mute, ban, etc)
 * @param {Number} punishmentDuration How long the punishment is for (mutes in days, suspensions in weeks)
 * @param {String} caseId DB ID of the associated case
 * @param {String} warningId DB ID of the warning this punishment resulted from (optional)
 * @param {String} timestamp ISO timestamp of the punishment (defaults to now)
 * @returns {Promise<Punishment>} A promise with the created punishment
 */
async function createPunishment(
	subjectId,
	moderatorId,
	punishmentType,
	punishmentDuration = null,
	caseId = null,
	warningId = null,
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
		warningId,
		timestamp,
		punishmentType,
		punishmentDuration,
	]);

	const punishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(res);
	if (punishments.length !== 1) throw new Error('Failed to create punishment');
	logger.info(`Created punishment ${punishments[0].getPunishmentId()} for user ${subjectId}`);
	return this.getPunishmentById(punishments[0].getPunishmentId());
}

/**
 * Gets a punishment by its ID with its case loaded
 *
 * @param {String} punishmentId The punishment's Database ID
 * @returns {Promise<Punishment|null>}
 */
async function getPunishmentById(punishmentId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/getPunishmentById.sql', [punishmentId]);
	const punishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(res);
	if (punishments.length !== 1) return null;
	await this._hydrateCases(punishments);
	return punishments[0];
}

/**
 * Updates an existing punishment and returns it with its case loaded
 *
 * @param {String} punishmentId The punishment's Database ID
 * @param {Object} fields Columns to update (e.g., { case_id: 5 })
 * @returns {Promise<Punishment>}
 */
async function updatePunishment(punishmentId, fields) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	if (!punishmentId || !fields || Object.keys(fields).length === 0) {
		throw new Error('punishmentId and at least one field are required to update a punishment');
	}

	const setClauses = Object.keys(fields)
		.map((key, idx) => `${key} = $${idx + 2}`)
		.join(', ');
	const res = await this._pool.query(
		`UPDATE Punishments SET ${setClauses} WHERE punishment_id = $1 RETURNING punishment_id`,
		[punishmentId, ...Object.values(fields)],
	);
	if (res.rows.length !== 1) throw new Error('Failed to update punishment');
	logger.info(`Updated punishment with punishment_id ${punishmentId}: ` + JSON.stringify(fields));
	return this.getPunishmentById(punishmentId);
}

/**
 * Gets every punishment issued to a user, with cases loaded
 *
 * @param {String} userId The user's Database ID
 * @returns {Promise<Punishment[]>}
 */
async function getPunishmentsBySubjectId(userId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/getPunishmentsBySubjectId.sql', [userId]);
	const punishments = globalThis.databaseResponseParser.parseDatabasePunishmentResponse(res);
	return this._hydrateCases(punishments);
}

/**
 * Gets a user's standalone punishments (punishments not attached to a case)
 *
 * @param {String} userId The user's Database ID
 * @returns {Promise<Punishment[]>} A promise to return an array of Punishment objects
 */
async function getStandalonePunishments(userId) {
	if (this._status !== 'success') {
		throw new Error('DB manager not initialized');
	}

	const res = await this._queryFile('queries/get/getStandalonePunishments.sql', [userId]);
	return globalThis.databaseResponseParser.parseDatabasePunishmentResponse(res);
}

/**
 * Returns all users that are currently banned.
 * A user is considered banned if the latest 'ban' punishment timestamp
 * is present and is newer than the latest 'unban' (or no unban exists).
 * @returns {Promise<User[]>}
 */
async function getCurrentlyBannedUsers() {
	return new Promise((resolve, reject) => {
		if (this._status !== 'success') {
			return reject('DB manager not initialized');
		}

		this._pool
			.query(this._loadSql('queries/get/getCurrentlyBannedUsers.sql'))
			.then((result) => {
				const users = globalThis.databaseResponseParser.parseDatabaseUserResponse({ rows: result.rows || [] });
				resolve(users);
			})
			.catch((error) => {
				logger.error('Error fetching currently banned users!');
				logger.error(error);
				reject('Error fetching currently banned users');
			});
	});
}

module.exports = {
	createPunishment,
	getPunishmentById,
	updatePunishment,
	getPunishmentsBySubjectId,
	getStandalonePunishments,
	getCurrentlyBannedUsers,
};
