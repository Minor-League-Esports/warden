const log4js = require('log4js');
const logger = log4js.getLogger('Case');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');

class Case {
	// Getters and setters
	setCaseId(caseId) {
		this._caseId = caseId;
	}

	getCaseId() {
		return this._caseId;
	}

	setCreatorId(userId) {
		this._creatorId = userId;
	}

	getCreatorId() {
		return this._creatorId;
	}

	setSubjectId(userId) {
		this._subjectId = userId;
	}

	getSubjectId() {
		return this._subjectId;
	}

	setModeratorId(userId) {
		this._moderatorId = userId;
	}

	getModeratorId() {
		return this._moderatorId ?? 'N/A';
	}

	/**
	 * Setter for the User who created this case
	 * @param {User} user
	 */
	setCreator(user) {
		this._creator = user;
	}

	/**
	 * Getter for the User who created this case
	 * @returns {User}
	 */
	getCreator() {
		return this._creator;
	}

	/**
	 * Setter for the User who is the subject of this case
	 * @param {User} user
	 */
	setSubjectUser(user) {
		this._subjectUser = user;
	}

	/**
	 * Getter for the User who is the subject of this case
	 * @returns {User}
	 */
	getSubjectUser() {
		return this._subjectUser;
	}

	/**
	 * Setter for the User who is the moderator assigned to this case
	 * @param {User} user
	 */
	setModerator(user) {
		this._moderator = user;
	}

	/**
	 * Getter for the User who is the moderator assigned to this case
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	setStatus(status) {
		this._status = status;
	}

	getStatus() {
		return this._status;
	}

	setCreatedAt(ts) {
		this._createdAt = ts;
	}

	getCreatedAt() {
		return this._createdAt;
	}

	setClosedAt(ts) {
		this._closedAt = ts;
	}

	getClosedAt() {
		return this._closedAt ?? null;
	}

	setNotes(notes) {
		this._notes = notes;
	}

	getNotes() {
		return this._notes ?? 'None';
	}

	setCaseLink(link) {
		this._caseLink = link;
	}

	getCaseLink() {
		return this._caseLink ?? null;
	}

	/**
	 * Setter for reports collection
	 * @param {Report[]} reports
	 */
	setReports(reports) {
		this._reports = reports;
	}

	/**
	 * Getter for reports collection
	 * @returns {Report[]}
	 */
	getReports() {
		return this._reports ?? [];
	}

	/**
	 * Returns each distinct reporter on reports attached to this case.
	 * @returns {String}
	 */
	getReporterNames() {
		const names = this.getReports()
			.map((report) => report.getReporter()?.getUserName())
			.filter(Boolean);
		return [...new Set(names)].join('\n') || 'None';
	}

	/**
	 * Setter for warnings collection
	 * @param {Warning[]} warnings
	 */
	setWarnings(warnings) {
		this._warnings = warnings;
	}

	/**
	 * Getter for warnings collection
	 * @returns {Warning[]}
	 */
	getWarnings() {
		return this._warnings ?? [];
	}

	/**
	 * Setter for punishments collection
	 * @param {Punishment[]} punishments
	 */
	setPunishments(punishments) {
		this._punishments = punishments;
	}

	/**
	 * Getter for punishments collection
	 * @returns {Punishment[]}
	 */
	getPunishments() {
		return this._punishments ?? [];
	}

	/**
	 * Generates an internal moderator-facing summary embed for the Case
	 * @returns {EmbedBuilder}
	 */
	generatePrivateEmbed() {
		const embed = new EmbedBuilder()
			.setTitle(`Case #${this.getCaseId()}`)
			.setTimestamp(new Date(this.getCreatedAt() ?? new Date().toISOString()))
			.setColor('#ff761b');

		embed.addFields(
			{
				name: 'Subject',
				value: String(this.getSubjectUser() ? `<@${this.getSubjectUser().getDiscordId()}>` : 'Unknown'),
				inline: true,
			},
			{ name: 'Status', value: String(this.getStatus() ?? 'Unknown'), inline: true },
			{ name: 'Moderator', value: String(this.getModerator()?.getUserName() ?? 'Unclaimed'), inline: true },
		);

		const notes = String(this.getNotes() ?? 'None');
		if (notes && notes.trim().length > 0) {
			embed.addFields({ name: 'Notes', value: notes });
		}

		if (this.getClosedAt()) {
			embed.addFields({ name: 'Closed At', value: new Date(this.getClosedAt()).toISOString(), inline: true });
		}

		return embed;
	}
}

module.exports = Case;
