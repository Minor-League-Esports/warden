const { EmbedBuilder } = require('discord.js');

class Warning {
	/**
	 * Setter for user ID
	 *
	 * @param {String} userId
	 */
	setUserId(userId) {
		this._userId = userId;
	}

	/**
	 * Getter for user ID
	 * @returns {String}
	 */
	getUserId() {
		return this._userId;
	}

	/**
	 * Setter for user name
	 *
	 * @param {String} userName
	 */
	setUserName(userName) {
		this._userName = userName;
	}

	/**
	 * Getter for user name
	 *
	 * @returns {String}
	 */
	getUserName() {
		return this._userName;
	}

	/**
	 * Setter for user discord ID
	 *
	 * @param {String} discordId
	 */
	setDiscordId(discordId) {
		this._discordId = discordId;
	}

	/**
	 * Getter for user discord ID
	 *
	 * @returns {String}
	 */
	getDiscordId() {
		return this._discordId;
	}

	/**
	 * Setter for user avatar
	 *
	 * @param {String} userAvatar
	 */
	setUserAvatar(userAvatar) {
		this._userAvatar = userAvatar;
	}

	/**
	 * Getter for user avatar
	 *
	 * @returns {String}
	 */
	getUserAvatar() {
		return this._userAvatar;
	}

	/**
	 * Setter for moderator name
	 *
	 * @param {String} moderatorName
	 */
	setModeratorName(moderatorName) {
		this._moderatorName = moderatorName;
	}

	/**
	 * Getter for moderator name
	 *
	 * @returns {String}
	 */
	getModeratorName() {
		return this._moderatorName;
	}

	/**
	 * Setter for reporter name
	 *
	 * @param {String} reporterName
	 */
	setReporterName(reporterName) {
		this._reporterName = reporterName;
	}

	/**
	 * Getter for reporter name
	 *
	 * @returns {String}
	 */
	getReporterName() {
		return this._reporterName;
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
	 * Setter for actions taken
	 *
	 * @param {String} actionsTaken
	 */
	setActionsTaken(actionsTaken) {
		this._actionsTaken = actionsTaken;
	}

	/**
	 * Getter for actions taken
	 * @returns {String}
	 */
	getActionsTaken() {
		return this._actionsTaken;
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
	 * To string method to represent the Warning as an Embed for moderators
	 *
	 * @returns {Embed}
	 */
	generatePrivateEmbed() {
		const embed = new EmbedBuilder()
			.setTitle(`${this.getUserName()} | Warning`)
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
				{ name: 'Actions Taken', value: String(this.getActionsTaken() ?? 'None') },
				{ name: 'Moderator Name', value: String(this.getModeratorName() ?? 'None'), inline: true },
				{ name: 'Reporter Name', value: String(this.getReporterName() ?? 'None'), inline: true },
				{ name: 'Moderator Notes', value: String(this.getModeratorNotes() ?? 'None') },
			)
			.setFooter({ text: `ID: ${this.getDiscordId()}` })
			.setThumbnail(this.getUserAvatar())
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
				{ name: 'Actions Taken', value: String(this.getActionsTaken() ?? 'None') },
			)
			.setFooter({ text: `ID: ${this.getDiscordId()}` })
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
			.setColor('#ff0000');
		return embed;
	}
}

module.exports = Warning;
