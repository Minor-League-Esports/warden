const log4js = require('log4js');
const logger = log4js.getLogger('Case');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');

class Case {
	/**
	 * Setter for case ID
	 * @param {String} caseId
	 */
	setCaseId(caseId) {
		this._caseId = caseId;
	}

	/**
	 * Getter for case ID
	 * @returns {String}
	 */
	getCaseId() {
		return this._caseId;
	}

	/**
	 * Setter for creator (reporting user or opener)
	 * @param {User} user
	 */
	setCreator(user) {
		this._creator = user;
	}

	/**
	 * Getter for creator
	 * @returns {User}
	 */
	getCreator() {
		return this._creator;
	}

	/**
	 * Setter for subject (user under investigation)
	 * @param {User} user
	 */
	setSubjectUser(user) {
		this._subjectUser = user;
	}

	/**
	 * Getter for subject user
	 * @returns {User}
	 */
	getSubjectUser() {
		return this._subjectUser;
	}

	/**
	 * Setter for assigned/acting moderator
	 * @param {User} user
	 */
	setModerator(user) {
		this._moderator = user;
	}

	/**
	 * Getter for moderator
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	/**
	 * Setter for case status
	 * @param {String} status
	 */
	setStatus(status) {
		this._status = status;
	}

	/**
	 * Getter for case status
	 * @returns {String}
	 */
	getStatus() {
		return this._status;
	}

	/**
	 * Setter for creation timestamp
	 * @param {Number|Date} ts
	 */
	setCreatedAt(ts) {
		this._createdAt = ts;
	}

	/**
	 * Getter for creation timestamp
	 * @returns {Number|Date}
	 */
	getCreatedAt() {
		return this._createdAt;
	}

	/**
	 * Setter for close timestamp
	 * @param {Number|Date} ts
	 */
	setClosedAt(ts) {
		this._closedAt = ts;
	}

	/**
	 * Getter for close timestamp
	 * @returns {Number|Date}
	 */
	getClosedAt() {
		return this._closedAt;
	}

	/**
	 * Setter for internal notes
	 * @param {String} notes
	 */
	setNotes(notes) {
		this._notes = notes;
	}

	/**
	 * Getter for internal notes
	 * @returns {String}
	 */
	getNotes() {
		return this._notes;
	}

	/**
	 * Setter for user-visible custom response
	 * @param {String} resp
	 */
	setCustomResponse(resp) {
		this._customResponse = resp;
	}

	/**
	 * Getter for user-visible custom response
	 * @returns {String}
	 */
	getCustomResponse() {
		return this._customResponse;
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
		return this._reports;
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
		return this._warnings;
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
		return this._punishments;
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
		);

		if (this.getModerator()) {
			embed.addFields({
				name: 'Moderator',
				value: String(this.getModerator().getUserName() ?? 'Unknown'),
				inline: true,
			});
		}

		const notes = String(this.getNotes() ?? 'None');
		if (notes && notes.trim().length > 0) {
			embed.addFields({ name: 'Notes', value: notes });
		}

		const cr = String(this.getCustomResponse() ?? '');
		if (cr && cr.trim().length > 0) {
			embed.addFields({ name: 'Custom Response', value: cr });
		}

		return embed;
	}
}

module.exports = Case;
