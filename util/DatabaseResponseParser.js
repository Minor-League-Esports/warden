const log4js = require('log4js');
const logger = log4js.getLogger('DatabaseResponseParser');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const User = require('./entity/User');
const Case = require('./entity/Case');
const Warning = require('./entity/Warning');
const Punishment = require('./entity/Punishment');
const Report = require('./entity/Report');

// Builds a User from a joined row's prefixed columns (e.g. prefix 'u_mod' -> u_mod_id, u_mod_discord_id, ...)
function buildUserFromPrefix(row, prefix) {
	if (!row[`${prefix}_id`]) return null;
	const u = new User();
	u.setUserId(row[`${prefix}_id`]);
	u.setDiscordId(row[`${prefix}_discord_id`]);
	u.setDiscordAvatar(row[`${prefix}_avatar`]);
	u.setUserName(row[`${prefix}_name`]);
	u.setMleId(row[`${prefix}_mle_id`]);
	return u;
}

class DatabaseResponseParser {
	/**
	 * Parses raw database data into an array of Users
	 *
	 * @param {*} res The raw DB data
	 * @returns {User[]} The parsed Users
	 */
	parseDatabaseUserResponse(res) {
		const users = [];

		for (const row of res.rows) {
			const u = new User();
			u.setUserId(row['user_id']);
			u.setDiscordId(row['discord_id']);
			u.setDiscordAvatar(row['discord_avatar']);
			u.setUserName(row['user_name']);
			u.setMleId(row['mle_id']);
			users.push(u);
		}

		return users;
	}

	/**
	 * Parses raw database data into an array of Cases
	 *
	 * @param {*} res The raw DB data
	 * @returns {Case[]} The parsed Cases
	 */
	parseDatabaseCaseResponse(res) {
		const cases = [];

		for (const row of res.rows) {
			const c = new Case();
			c.setCaseId(row['case_id']);
			c.setCreatorId(row['creator_id']);
			c.setSubjectId(row['subject_id']);
			c.setModeratorId(row['moderator_id']);
			c.setStatus(row['status']);
			c.setCreatedAt(row['created_at']);
			c.setClosedAt(row['closed_at']);
			c.setNotes(row['moderator_notes']);
			c.setCaseLink(row['case_link']);
			cases.push(c);
		}

		return cases;
	}

	/**
	 * Parses raw database data into an array of Warnings
	 *
	 * @param {*} res The raw DB data
	 * @returns {Warning[]} The parsed Warnings
	 */
	parseDatabaseWarningResponse(res) {
		const warnings = [];

		for (const row of res.rows) {
			const w = new Warning();
			w.setWarningId(row['warning_id']);
			w.setSubjectId(row['subject_id']);
			w.setModeratorId(row['moderator_id']);
			w.setReporterId(row['reporter_id']);
			w.setCase(row['case_id']);
			w.setTimestamp(row['timestamp']);
			w.setRulesBroken(row['rules_broken']);
			w.setViolatingContent(row['violating_content']);
			w.setPointsAdded(row['points_added']);
			w.setNewPointTotal(row['new_point_total']);
			w.setModeratorNotes(row['moderator_notes']);
			w.setSubject(buildUserFromPrefix(row, 'u_user'));
			w.setModerator(buildUserFromPrefix(row, 'u_mod'));
			w.setReporter(buildUserFromPrefix(row, 'u_rep'));
			warnings.push(w);
		}

		return warnings;
	}

	/**
	 * Parses raw database data into an array of Punishments
	 *
	 * @param {*} res The raw DB data
	 * @returns {Punishment[]} The parsed Punishments
	 */
	parseDatabasePunishmentResponse(res) {
		const punishments = [];

		for (const row of res.rows) {
			const p = new Punishment();
			p.setPunishmentId(row['punishment_id']);
			p.setSubjectId(row['subject_id']);
			p.setModeratorId(row['moderator_id']);
			p.setCaseId(row['case_id']);
			p.setTimestamp(row['timestamp']);
			p.setType(row['punishment_type']);
			p.setDuration(row['punishment_duration']);
			p.setSubject(buildUserFromPrefix(row, 'u_user'));
			p.setModerator(buildUserFromPrefix(row, 'u_mod'));
			punishments.push(p);
		}

		return punishments;
	}

	/**
	 * Parses raw database data into an array of Reports
	 *
	 * @param {*} res The raw DB data
	 * @returns {Report[]} The parsed Reports
	 */
	parseDatabaseReportResponse(res) {
		const reports = [];

		for (const row of res.rows) {
			const r = new Report();
			r.setReportId(row['report_id']);
			r.setReporterId(row['reporter_id']);
			r.setSubjectId(row['subject_id']);
			r.setModeratorId(row['moderator_id']);
			r.setCaseId(row['case_id']);
			r.setReportTimestamp(row['report_timestamp']);
			r.setAcknowledgeTimestamp(row['acknowledge_timestamp']);
			r.setCloseTimestamp(row['close_timestamp']);
			r.setReportLink(row['report_link']);
			r.setReportReason(row['report_reason']);
			r.setReportEvidence(row['report_evidence']);
			r.setStatus(row['status']);
			r.setModeratorNotes(row['moderator_notes']);
			r.setResponse(row['response']);
			reports.push(r);
		}

		return reports;
	}
}

module.exports = { DatabaseResponseParser };
