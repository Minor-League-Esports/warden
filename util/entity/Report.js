const log4js = require('log4js');
const logger = log4js.getLogger('Report');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');
const {
	chunkTextPreserveNewlines,
	resolveEvidenceLinksForUser,
	resolveEvidenceLinksForModerators,
	convertDateToTimestamp,
} = require('../UtilFunctions');

class Report {
	// Getters and setters
	setReportId(reportId) {
		this._reportId = reportId;
	}

	getReportId() {
		return this._reportId;
	}

	setReporterId(reporterId) {
		this._reporterId = reporterId;
	}

	getReporterId() {
		return this._reporterId;
	}

	setReporter(user) {
		this._reporter = user;
	}

	getReporter() {
		return this._reporter;
	}

	setSubjectId(userId) {
		this._subjectId = userId;
	}

	getSubjectId() {
		return this._subjectId;
	}

	setModeratorId(moderatorId) {
		this._moderatorId = moderatorId;
	}

	getModeratorId() {
		return this._moderatorId;
	}

	/**
	 * Setter for the User who is the subject of this report
	 * @param {User} user
	 */
	setSubjectUser(user) {
		this._subjectUser = user;
	}

	/**
	 * Getter for the User who is the subject of this report
	 * @returns {User}
	 */
	getSubjectUser() {
		return this._subjectUser;
	}

	/**
	 * Setter for the User who is the moderator assigned to this report
	 * @param {User} user
	 */
	setModerator(user) {
		this._moderator = user;
	}

	/**
	 * Getter for the User who is the moderator assigned to this report
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	setCaseId(caseId) {
		this._caseId = caseId;
	}

	getCaseId() {
		return this._caseId;
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

	setReportTimestamp(timestamp) {
		this._reportTimestamp = timestamp;
	}

	getReportTimestamp() {
		return this._reportTimestamp;
	}

	setAcknowledgeTimestamp(timestamp) {
		this._acknowledgeTimestamp = timestamp;
	}

	getAcknowledgeTimestamp() {
		return this._acknowledgeTimestamp;
	}

	setCloseTimestamp(timestamp) {
		this._closeTimestamp = timestamp;
	}

	getCloseTimestamp() {
		return this._closeTimestamp;
	}

	setReportLink(link) {
		this._reportLink = link;
	}

	getReportLink() {
		return this._reportLink;
	}

	setReportThreadLink(link) {
		this._reportThreadLink = link;
	}

	getReportThreadLink() {
		return this._reportThreadLink;
	}

	setReportReason(reason) {
		this._reportReason = reason;
	}

	addReasonDetails(details) {
		if (this._reportReason && this._reportReason != 'N/A') {
			this._reportReason += `\n__${convertDateToTimestamp(new Date())}__\n${details}`;
		} else {
			this._reportReason = `__${convertDateToTimestamp(new Date())}__\n${details}`;
		}
	}

	getReportReason() {
		return this._reportReason;
	}

	setReportEvidence(evidence) {
		this._reportEvidence = evidence;
	}

	addReportEvidence(evidence) {
		if (this._reportEvidence && this._reportEvidence != 'N/A') {
			this._reportEvidence += `\n__${convertDateToTimestamp(new Date())}__\n${evidence}`;
		} else {
			this._reportEvidence = `__${convertDateToTimestamp(new Date())}__\n${evidence}`;
		}
	}

	getReportEvidence() {
		return this._reportEvidence;
	}

	setStatus(status) {
		this._status = status;
	}

	getStatus() {
		return this._status;
	}

	setModeratorNotes(notes) {
		this._moderatorNotes = notes;
	}

	getModeratorNotes() {
		return this._moderatorNotes;
	}

	addModeratorNote(note) {
		if (this._moderatorNotes && this._moderatorNotes != 'N/A') {
			this._moderatorNotes += `\n__${convertDateToTimestamp(new Date())}__\n${note}`;
		} else {
			this._moderatorNotes = `__${convertDateToTimestamp(new Date())}__\n${note}`;
		}
	}

	setResponse(response) {
		this._response = response;
	}

	getResponse() {
		return this._response;
	}

	isAcknowledged() {
		return this._acknowledgeTimestamp != null;
	}

	isClosed() {
		return this._closeTimestamp != null;
	}

	async generateSummaryEmbed() {
		const subject = await globalThis.databaseManager.getUserByIdentifier(this.getSubjectId(), 'db');
		const reporter = await globalThis.databaseManager.getUserByIdentifier(this.getReporterId(), 'db');
		const caseIdValue = this.getCase()
			? this.getCase().getCaseThreadLink()
				? `[#${this.getCaseId()}](${this.getCase().getCaseThreadLink()})`
				: `#${this.getCaseId()}`
			: 'None';
		const reportIdValue = this.getReportLink()
			? `[#${this.getReportId()}](${this.getReportLink()})`
			: `#${this.getReportId()}`;
		const embed = new EmbedBuilder()
			.setTitle(`Report #${this.getReportId() ?? 'None'}`)
			.setTimestamp(new Date(this.getReportTimestamp() ?? new Date().toISOString()))
			.addFields(
				{ name: 'Reporter', value: String(reporter?.getUserName() ?? 'Unknown'), inline: true },
				{ name: 'Status', value: String(this.getStatus() ?? 'Unknown') },
				{ name: 'Case ID', value: caseIdValue, inline: true },
				{ name: 'Report ID', value: reportIdValue, inline: true },
			)
			.setFooter({ text: `ID: ${subject?.getDiscordId() ?? 'Unknown'}` })
			.setThumbnail(subject?.getDiscordAvatar() ?? null)
			.setColor('#ff761b');

		return embed;
	}

	/**
	 * Generates an embed for moderator view of a report
	 *
	 * @returns {EmbedBuilder}
	 */
	async generatePrivateEmbed() {
		const subject = await globalThis.databaseManager.getUserByIdentifier(this.getSubjectId(), 'db');
		const reporter = await globalThis.databaseManager.getUserByIdentifier(this.getReporterId(), 'db');
		const caseIdValue = this.getCase()
			? this.getCase().getCaseThreadLink()
				? `[#${this.getCaseId()}](${this.getCase().getCaseThreadLink()})`
				: `#${this.getCaseId()}`
			: 'None';
		const reportIdValue = this.getReportLink()
			? `[#${this.getReportId()}](${this.getReportLink()})`
			: `#${this.getReportId()}`;
		const embed = new EmbedBuilder()
			.setTitle(`${subject?.getUserName() ?? 'User'} | Report`)
			.setTimestamp(new Date(this.getReportTimestamp() ?? new Date().toISOString()))
			.addFields(
				{ name: 'Reporter', value: String(reporter?.getUserName() ?? 'Unknown'), inline: true },
				{ name: 'Status', value: String(this.getStatus() ?? 'Unknown') },
				{ name: 'Case ID', value: caseIdValue, inline: true },
				{ name: 'Report ID', value: reportIdValue, inline: true },
			)
			.setFooter({ text: `ID: ${subject?.getDiscordId() ?? 'Unknown'}` })
			.setThumbnail(subject?.getDiscordAvatar() ?? null)
			.setColor('#ff761b');

		// Report Reason (may be long)
		const reason = String(this.getReportReason() ?? 'None');
		const reasonChunks = chunkTextPreserveNewlines(reason, 1024);
		for (let i = 0; i < reasonChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Report Reason' : 'Report Reason (cont.)', value: reasonChunks[i] });
		}

		// Evidence (may be long)
		let evidenceText = 'None';
		try {
			const lines = await resolveEvidenceLinksForModerators(
				this.getCase().getCaseThreadLink(),
				this.getReportEvidence(),
			);
			evidenceText = lines.length ? lines.join('\n') : 'None';
		} catch (e) {
			logger.error('Error building evidence for moderator embed', e);
		}

		const evidenceChunks = chunkTextPreserveNewlines(evidenceText, 1024);
		for (let i = 0; i < evidenceChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Evidence' : 'Evidence (cont.)', value: evidenceChunks[i] });
		}

		// Moderator notes (may be long)
		const modNotes = String(this.getModeratorNotes() ?? 'None');
		const notesChunks = chunkTextPreserveNewlines(modNotes, 1024);
		for (let i = 0; i < notesChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Moderator Notes' : 'Moderator Notes (cont.)', value: notesChunks[i] });
		}

		// Response (optional)
		const response = this.getResponse();
		if (response) {
			const respChunks = chunkTextPreserveNewlines(String(response), 1024);
			for (let i = 0; i < respChunks.length; i++) {
				embed.addFields({ name: i === 0 ? 'Response' : 'Response (cont.)', value: respChunks[i] });
			}
		}

		// Additional timestamps
		if (this.getAcknowledgeTimestamp()) {
			embed.addFields({
				name: 'Acknowledged At',
				value: convertDateToTimestamp(new Date(this.getAcknowledgeTimestamp())),
				inline: true,
			});
		}
		if (this.getCloseTimestamp()) {
			embed.addFields({
				name: 'Closed At',
				value: convertDateToTimestamp(new Date(this.getCloseTimestamp())),
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
	async generateUserEmbed() {
		const subject = await globalThis.databaseManager.getUserByIdentifier(this.getSubjectId(), 'db');
		const embed = new EmbedBuilder()
			.setTitle(`MLE Moderation Update: Report #${this.getReportId()}`)
			.setTimestamp(new Date(this.getReportTimestamp() ?? new Date().toISOString()))
			.setDescription(
				'To attach evidence to this report, use the `/report evidence` command. To provide more details, use the `/report update` command or the button below.',
			)
			.addFields(
				{
					name: 'Reported User',
					value: String(subject ? `<@${subject.getDiscordId()}>` : 'Unknown'),
					inline: true,
				},
				{ name: 'Status', value: String(this.getStatus() ?? 'Unknown'), inline: true },
			)
			.setFooter({ text: 'Note: Evidence links expire. Run `/report status` to view the latest evidence.' })
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
			.setColor('#ff0000');

		// Reason (may be long)
		const reason = String(this.getReportReason() ?? 'None');
		const reasonChunks = chunkTextPreserveNewlines(reason, 1024);
		for (let i = 0; i < reasonChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Reason' : 'Reason (cont.)', value: reasonChunks[i] });
		}

		// Evidence (may be long)
		let evidenceText = 'None';
		try {
			const cdnOnly = await resolveEvidenceLinksForUser(this.getCase().getCaseThreadLink(), this.getReportEvidence());
			evidenceText = cdnOnly.length ? cdnOnly.join('\n') : 'None';
		} catch (e) {
			logger.error('Error building evidence for user embed', e);
		}

		const evidenceChunks = chunkTextPreserveNewlines(evidenceText, 1024);
		for (let i = 0; i < evidenceChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Evidence' : 'Evidence (cont.)', value: evidenceChunks[i] });
		}

		// Response (optional)
		const response = this.getResponse();
		if (response) {
			const respChunks = chunkTextPreserveNewlines(String(response), 1024);
			for (let i = 0; i < respChunks.length; i++) {
				embed.addFields({ name: i === 0 ? 'Response from MLE Moderation' : 'Response (cont.)', value: respChunks[i] });
			}
		}

		// Status timestamps (if present)
		if (this.getAcknowledgeTimestamp()) {
			embed.addFields({
				name: 'Acknowledged At',
				value: convertDateToTimestamp(new Date(this.getAcknowledgeTimestamp())),
				inline: true,
			});
		}
		if (this.getCloseTimestamp()) {
			embed.addFields({
				name: 'Closed At',
				value: convertDateToTimestamp(new Date(this.getCloseTimestamp())),
				inline: true,
			});
		}

		return embed;
	}
}

module.exports = Report;
