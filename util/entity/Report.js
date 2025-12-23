const log4js = require('log4js');
const logger = log4js.getLogger('Report');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');
const { chunkTextPreserveNewlines } = require('../UtilFunctions');

class Report {
	/**
	 * Setter for report ID
	 *
	 * @param {String} reportId
	 */
	setReportId(reportId) {
		this._reportId = reportId;
	}

	/**
	 * Getter for report ID
	 *
	 * @returns {String}
	 */
	getReportId() {
		return this._reportId;
	}

	/**
	 * Setter for reporter object
	 *
	 * @param {User} reporter
	 */
	setReporter(reporter) {
		this._reporter = reporter;
	}

	/**
	 * Getter for reporter object
	 *
	 * @returns {User}
	 */
	getReporter() {
		return this._reporter;
	}

	/**
	 * Setter for user object
	 *
	 * @param {User} user
	 */
	setSubject(user) {
		this._subject = user;
	}

	/**
	 * Getter for user object
	 *
	 * @returns {User}
	 */
	getSubject() {
		return this._subject;
	}

	/**
	 * Setter for moderator object
	 *
	 * @param {User} moderator
	 */
	setModerator(moderator) {
		this._moderator = moderator;
	}

	/**
	 * Getter for moderator object
	 *
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	/**
	 * Setter for report timestamp
	 *
	 * @param {Number|Date} timestamp
	 */
	setReportTimestamp(timestamp) {
		this._reportTimestamp = timestamp;
	}

	/**
	 * Getter for report timestamp
	 *
	 * @returns {Number|Date}
	 */
	getReportTimestamp() {
		return this._reportTimestamp;
	}

	/**
	 * Setter for acknowledge timestamp
	 *
	 * @param {Number|Date} timestamp
	 */
	setAcknowledgeTimestamp(timestamp) {
		this._acknowledgeTimestamp = timestamp;
	}

	/**
	 * Getter for acknowledge timestamp
	 *
	 * @returns {Number|Date}
	 */
	getAcknowledgeTimestamp() {
		return this._acknowledgeTimestamp;
	}

	/**
	 * Setter for close timestamp
	 *
	 * @param {Number|Date} timestamp
	 */
	setCloseTimestamp(timestamp) {
		this._closeTimestamp = timestamp;
	}

	/**
	 * Getter for close timestamp
	 *
	 * @returns {Number|Date}
	 */
	getCloseTimestamp() {
		return this._closeTimestamp;
	}

	/**
	 * Setter for report reason
	 *
	 * @param {String} reason
	 */
	setReportReason(reason) {
		this._reportReason = reason;
	}

	/**
	 * Getter for report reason
	 *
	 * @returns {String}
	 */
	getReportReason() {
		return this._reportReason;
	}

	/**
	 * Setter for report evidence
	 *
	 * @param {String} evidence
	 */
	setReportEvidence(evidence) {
		this._reportEvidence = evidence;
	}

	/**
	 * Getter for report evidence
	 *
	 * @returns {String}
	 */
	getReportEvidence() {
		return this._reportEvidence;
	}

	/**
	 * Setter for status
	 *
	 * @param {String} status
	 */
	setStatus(status) {
		this._status = status;
	}

	/**
	 * Getter for status
	 *
	 * @returns {String}
	 */
	getStatus() {
		return this._status;
	}

	/**
	 * Setter for moderator notes
	 *
	 * @param {String} notes
	 */
	setModeratorNotes(notes) {
		this._moderatorNotes = notes;
	}

	/**
	 * Getter for moderator notes
	 *
	 * @returns {String}
	 */
	getModeratorNotes() {
		return this._moderatorNotes;
	}

	/**
	 * Setter for custom response
	 *
	 * @param {String} response
	 */
	setCustomResponse(response) {
		this._customResponse = response;
	}

	/**
	 * Getter for custom response
	 *
	 * @returns {String}
	 */
	getCustomResponse() {
		return this._customResponse;
	}

	/**
	 * Setter for Case object
	 * @param {Case} kase
	 */
	setCase(kase) {
		this._case = kase;
	}

	/**
	 * Getter for Case object
	 * @returns {Case}
	 */
	getCase() {
		return this._case;
	}

	/**
	 * Generates an embed for moderator view of a report
	 *
	 * @returns {EmbedBuilder}
	 */
	generatePrivateEmbed() {
		const embed = new EmbedBuilder()
			.setTitle(`${this.getSubject()?.getUserName() ?? 'User'} | Report`)
			.setTimestamp(new Date(this.getReportTimestamp() ?? new Date().toISOString()))
			.addFields(
				{
					name: 'Reported User',
					value: String(this.getSubject() ? `<@${this.getSubject().getDiscordId()}>` : 'Unknown'),
					inline: true,
				},
				{ name: 'Reporter', value: String(this.getReporter()?.getUserName() ?? 'Unknown'), inline: true },
				{ name: 'Status', value: String(this.getStatus() ?? 'Unknown'), inline: true },
			)
			.setFooter({ text: `ID: ${this.getSubject()?.getDiscordId() ?? 'Unknown'}` })
			.setThumbnail(this.getSubject()?.getDiscordAvatar() ?? null)
			.setColor('#ff761b');

		// Report Reason (may be long)
		const reason = String(this.getReportReason() ?? 'None');
		const reasonChunks = chunkTextPreserveNewlines(reason, 1024);
		for (let i = 0; i < reasonChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Report Reason' : 'Report Reason (cont.)', value: reasonChunks[i] });
		}

		// Evidence (may be long)
		const evidence = String(this.getReportEvidence() ?? 'None');
		const evidenceChunks = chunkTextPreserveNewlines(evidence, 1024);
		for (let i = 0; i < evidenceChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Evidence' : 'Evidence (cont.)', value: evidenceChunks[i] });
		}

		// Moderator notes (may be long)
		const modNotes = String(this.getModeratorNotes() ?? 'None');
		const notesChunks = chunkTextPreserveNewlines(modNotes, 1024);
		for (let i = 0; i < notesChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Moderator Notes' : 'Moderator Notes (cont.)', value: notesChunks[i] });
		}

		// Custom response (optional)
		const customResp = this.getCustomResponse();
		if (customResp) {
			const respChunks = chunkTextPreserveNewlines(String(customResp), 1024);
			for (let i = 0; i < respChunks.length; i++) {
				embed.addFields({ name: i === 0 ? 'Custom Response' : 'Custom Response (cont.)', value: respChunks[i] });
			}
		}

		// Additional timestamps
		if (this.getAcknowledgeTimestamp()) {
			embed.addFields({
				name: 'Acknowledged At',
				value: new Date(this.getAcknowledgeTimestamp()).toISOString(),
				inline: true,
			});
		}
		if (this.getCloseTimestamp()) {
			embed.addFields({ name: 'Closed At', value: new Date(this.getCloseTimestamp()).toISOString(), inline: true });
		}

		if (this.getModerator()) {
			embed.addFields({
				name: 'Moderator Name',
				value: String(this.getModerator()?.getUserName() ?? 'Unknown'),
				inline: true,
			});
		}

		return embed;
	}

	/**
	 * Generates an embed for the reporting user's view of a report
	 * Excludes moderator identity and moderator notes
	 *
	 * @returns {EmbedBuilder}
	 */
	generateUserEmbed() {
		const embed = new EmbedBuilder()
			.setTitle('MLE Moderation Update: Your Report')
			.setTimestamp(new Date(this.getReportTimestamp() ?? new Date().toISOString()))
			.addFields(
				{
					name: 'Reported User',
					value: String(this.getSubject() ? `<@${this.getSubject().getDiscordId()}>` : 'Unknown'),
					inline: true,
				},
				{ name: 'Status', value: String(this.getStatus() ?? 'Unknown'), inline: true },
			)
			.setFooter({ text: `ID: ${this.getReporter()?.getDiscordId() ?? 'Unknown'}` })
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
			.setColor('#ff0000');

		// Reason (may be long)
		const reason = String(this.getReportReason() ?? 'None');
		const reasonChunks = chunkTextPreserveNewlines(reason, 1024);
		for (let i = 0; i < reasonChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Reason' : 'Reason (cont.)', value: reasonChunks[i] });
		}

		// Evidence (may be long)
		const evidence = String(this.getReportEvidence() ?? 'None');
		const evidenceChunks = chunkTextPreserveNewlines(evidence, 1024);
		for (let i = 0; i < evidenceChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Evidence' : 'Evidence (cont.)', value: evidenceChunks[i] });
		}

		// Custom response from moderation (optional; shown to reporter)
		const customResp = this.getCustomResponse();
		if (customResp) {
			const respChunks = chunkTextPreserveNewlines(String(customResp), 1024);
			for (let i = 0; i < respChunks.length; i++) {
				embed.addFields({
					name: i === 0 ? 'Response from Moderation' : 'Response from Moderation (cont.)',
					value: respChunks[i],
				});
			}
		}

		// Status timestamps (if present)
		if (this.getAcknowledgeTimestamp()) {
			embed.addFields({
				name: 'Acknowledged At',
				value: new Date(this.getAcknowledgeTimestamp()).toISOString(),
				inline: true,
			});
		}
		if (this.getCloseTimestamp()) {
			embed.addFields({ name: 'Closed At', value: new Date(this.getCloseTimestamp()).toISOString(), inline: true });
		}

		return embed;
	}
}

module.exports = Report;
