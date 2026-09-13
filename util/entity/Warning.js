const { EmbedBuilder } = require('discord.js');
const { chunkTextPreserveNewlines } = require('../UtilFunctions');

class Warning {
	// Getters and setters
	setWarningId(warningId) {
		this._warningId = warningId;
	}

	getWarningId() {
		return this._warningId;
	}

	setSubjectId(subjectId) {
		this._subjectId = subjectId;
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
	 * Setter for the User who was warned
	 * @param {User} user
	 */
	setSubject(user) {
		this._subject = user;
	}

	/**
	 * Getter for the User who was warned
	 * @returns {User}
	 */
	getSubject() {
		return this._subject;
	}

	/**
	 * Setter for the User who issued the warning
	 * @param {User} user
	 */
	setModerator(user) {
		this._moderator = user;
	}

	/**
	 * Getter for the User who issued the warning
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	setCaseId(caseId) {
		this._caseId = caseId;
	}

	getCaseId() {
		return this._caseId ?? 'N/A';
	}

	setTimestamp(timestamp) {
		this._timestamp = timestamp;
	}

	getTimestamp() {
		return this._timestamp;
	}

	setRulesBroken(rulesBroken) {
		this._rulesBroken = rulesBroken;
	}

	getRulesBroken() {
		return this._rulesBroken;
	}

	setViolatingContent(violatingContent) {
		this._violatingContent = violatingContent;
	}

	getViolatingContent() {
		return this._violatingContent;
	}

	setPointsAdded(pointsAdded) {
		this._pointsAdded = pointsAdded;
	}

	getPointsAdded() {
		return this._pointsAdded;
	}

	setNewPointTotal(newPointTotal) {
		this._newPointTotal = newPointTotal;
	}
	getNewPointTotal() {
		return this._newPointTotal;
	}

	setModeratorNotes(moderatorNotes) {
		this._moderatorNotes = moderatorNotes;
	}

	getModeratorNotes() {
		return this._moderatorNotes ?? 'None';
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
	 * Getter for punishment friendly strings
	 *
	 * @returns {String}
	 */
	getPunishmentFriendlyStrings() {
		if (!this._punishments || this._punishments.length === 0) return 'None';
		return this._punishments.map((p) => p.getFriendlyString()).join('\n');
	}

	/**
	 * To string method to represent the Warning as an Embed for moderators
	 *
	 * @param {String|null} caseLink Optional jump link to the case's discussion thread
	 * @param {String} reporters Names of reporters attached to the parent case
	 * @returns {Embed}
	 */
	generatePrivateEmbed(caseLink = null, reporters = 'None') {
		const caseValue =
			this.getCaseId() && this.getCaseId() !== 'N/A'
				? caseLink
					? `[#${this.getCaseId()}](${caseLink})`
					: `#${this.getCaseId()}`
				: 'None';
		const embed = new EmbedBuilder()
			.setTitle(`${this.getSubject().getUserName()} | Warning`)
			.setTimestamp(new Date(this.getTimestamp()))

			.setFooter({ text: `ID: ${this.getSubject().getDiscordId()}` })
			.setThumbnail(this.getSubject().getDiscordAvatar())
			.setColor('#ff761b');

		// Fields below may be arbitrarily long (e.g. legacy-imported data), so chunk to stay under Discord's 1024 char field limit
		const rulesChunks = chunkTextPreserveNewlines(String(this.getRulesBroken() ?? 'None'), 1024);
		for (let i = 0; i < rulesChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Rule(s) Broken' : 'Rule(s) Broken (cont.)', value: rulesChunks[i] });
		}

		const contentChunks = chunkTextPreserveNewlines(String(this.getViolatingContent() ?? 'None'), 1024);
		for (let i = 0; i < contentChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Violating Content' : 'Violating Content (cont.)', value: contentChunks[i] });
		}

		embed.addFields(
			{
				name: 'Points Added',
				value: String(this.getPointsAdded() === 1 ? '1 point' : `${this.getPointsAdded()} points`),
				inline: true,
			},
			{
				name: 'Current Points (at time of warn)',
				value: String(this.getNewPointTotal() === 1 ? '1 point' : `${this.getNewPointTotal()} points`),
				inline: true,
			},
		);

		const actionsChunks = chunkTextPreserveNewlines(String(this.getPunishmentFriendlyStrings()), 1024);
		for (let i = 0; i < actionsChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Actions Taken' : 'Actions Taken (cont.)', value: actionsChunks[i] });
		}

		embed.addFields(
			{ name: 'Moderator Name', value: String(this.getModerator()?.getUserName() ?? 'None'), inline: true },
			{ name: 'Case', value: caseValue, inline: true },
			{ name: 'Reporters', value: String(reporters), inline: true },
		);

		const notesChunks = chunkTextPreserveNewlines(String(this.getModeratorNotes() ?? 'None'), 1024);
		for (let i = 0; i < notesChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Moderator Notes' : 'Moderator Notes (cont.)', value: notesChunks[i] });
		}

		return embed;
	}

	/**
	 * To string method to represent the Warning as an Embed for users
	 *
	 * @returns {Embed}
	 */
	generateUserEmbed() {
		const embed = new EmbedBuilder()
			.setTitle('You have recieved an official warning from MLE Moderation')
			.setTimestamp(new Date(this.getTimestamp()))
			.setFooter({ text: `ID: ${this.getSubject().getDiscordId()}` })
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
			.setColor('#ff0000');

		// Fields below may be arbitrarily long (e.g. legacy-imported data), so chunk to stay under Discord's 1024 char field limit
		const rulesChunks = chunkTextPreserveNewlines(String(this.getRulesBroken() ?? 'None'), 1024);
		for (let i = 0; i < rulesChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Rule(s) Broken' : 'Rule(s) Broken (cont.)', value: rulesChunks[i] });
		}

		const contentChunks = chunkTextPreserveNewlines(String(this.getViolatingContent() ?? 'None'), 1024);
		for (let i = 0; i < contentChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Violating Content' : 'Violating Content (cont.)', value: contentChunks[i] });
		}

		embed.addFields(
			{
				name: 'Points Added',
				value: String(this.getPointsAdded() === 1 ? '1 point' : `${this.getPointsAdded()} points`),
				inline: true,
			},
			{
				name: 'Current Points',
				value: String(this.getNewPointTotal() === 1 ? '1 point' : `${this.getNewPointTotal()} points`),
				inline: true,
			},
		);

		const actionsChunks = chunkTextPreserveNewlines(String(this.getPunishmentFriendlyStrings()), 1024);
		for (let i = 0; i < actionsChunks.length; i++) {
			embed.addFields({ name: i === 0 ? 'Actions Taken' : 'Actions Taken (cont.)', value: actionsChunks[i] });
		}

		return embed;
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
}

module.exports = Warning;
