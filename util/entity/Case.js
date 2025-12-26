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
