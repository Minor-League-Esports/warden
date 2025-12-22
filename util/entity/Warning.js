const { EmbedBuilder } = require('discord.js');

class Warning {
	/**
	 * Sets the warning ID
	 *
	 * @param {String} warningId
	 */
	setWarningId(warningId) {
		this._warningId = warningId;
	}

	/**
	 * Gets the warning ID
	 * @returns {String}
	 */
	getWarningId() {
		return this._warningId;
	}

	/**
	 * Sets the user object
	 *
	 * @param {User} user
	 */
	setUser(user) {
		this._user = user;
	}

	/**
	 * Gets the user object
	 *
	 * @returns {User}
	 */
	getUser() {
		return this._user;
	}

	/**
	 * Sets the moderator object
	 *
	 * @param {User} moderator
	 */
	setModerator(moderator) {
		this._moderator = moderator;
	}

	/**
	 * Gets the moderator
	 *
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	/**
	 * Sets the repoter
	 *
	 * @param {User} reporter
	 */
	setReporter(reporter) {
		this._reporter = reporter;
	}

	/**
	 * Gets the reporter
	 *
	 * @returns {User}
	 */
	getReporter() {
		return this._reporter;
	}

	/**
	 * Setter for timestamp
	 *
	 * @param {Number|Date} timestamp
	 */
	setTimestamp(timestamp) {
		this._timestamp = timestamp;
	}

	/**
	 * Getter for timestamp
	 *
	 * @returns {Number|Date}
	 */
	getTimestamp() {
		return this._timestamp;
	}

	/**
	 * Setter for rules broken
	 *
	 * @param {String} rulesBroken
	 */
	setRulesBroken(rulesBroken) {
		this._rulesBroken = rulesBroken;
	}

	/**
	 * Getter for rules broken
	 *
	 * @returns {String}
	 */
	getRulesBroken() {
		return this._rulesBroken;
	}

	/**
	 * Setter for violating content
	 *
	 * @param {String} violatingContent
	 */
	setViolatingContent(violatingContent) {
		this._violatingContent = violatingContent;
	}

	/**
	 * Getter for violating content
	 *
	 * @returns {String}
	 */
	getViolatingContent() {
		return this._violatingContent;
	}

	/**
	 * Setter for points added
	 *
	 * @param {Number} pointsAdded
	 */
	setPointsAdded(pointsAdded) {
		this._pointsAdded = pointsAdded;
	}

	/**
	 * Getter for points added
	 *
	 * @returns {Number}
	 */
	getPointsAdded() {
		return this._pointsAdded;
	}

	/**
	 * Setter for new point total
	 *
	 * @param {Number} newPointTotal
	 */
	setNewPointTotal(newPointTotal) {
		this._newPointTotal = newPointTotal;
	}

	/**
	 * Getter for new point total
	 *
	 * @returns {Number}
	 */
	getNewPointTotal() {
		return this._newPointTotal;
	}

	/**
	 * Setter for moderator notes
	 *
	 * @param {String} moderatorNotes
	 */
	setModeratorNotes(moderatorNotes) {
		this._moderatorNotes = moderatorNotes;
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
	 * Setter for punishments
	 *
	 * @param {Array<Punishment>} punishments
	 */
	setPunishments(punishments) {
		this._punishments = punishments;
	}

	/**
	 * Getter for punishments
	 *
	 * @returns {Array<Punishment>}
	 */
	getPunishments() {
		return this._punishments;
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
	 * @returns {Embed}
	 */
	generatePrivateEmbed() {
		const embed = new EmbedBuilder()
			.setTitle(`${this.getUser().getUserName()} | Warning`)
			.setTimestamp(new Date(this.getTimestamp()))
			.addFields(
				{ name: 'Rule(s) Broken', value: String(this.getRulesBroken() ?? 'None') },
				{ name: 'Violating Content', value: String(this.getViolatingContent() ?? 'None') },
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
				{
					name: 'Actions Taken',
					value: String(this.getPunishmentFriendlyStrings()),
				},
				{ name: 'Moderator Name', value: String(this.getModerator()?.getUserName() ?? 'None'), inline: true },
				{ name: 'Reporter Name', value: String(this.getReporter()?.getUserName() ?? 'None'), inline: true },
				{ name: 'Moderator Notes', value: String(this.getModeratorNotes() ?? 'None') },
			)
			.setFooter({ text: `ID: ${this.getUser().getDiscordId()}` })
			.setThumbnail(this.getUser().getDiscordAvatar())
			.setColor('#ff761b');
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
			.addFields(
				{ name: 'Rule(s) Broken', value: String(this.getRulesBroken() ?? 'None') },
				{ name: 'Violating Content', value: String(this.getViolatingContent() ?? 'None') },
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
				{
					name: 'Actions Taken',
					value: String(this.getPunishmentFriendlyStrings()),
				},
			)
			.setFooter({ text: `ID: ${this.getUser().getDiscordId()}` })
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
			.setColor('#ff0000');
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
