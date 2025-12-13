const { EmbedBuilder } = require('discord.js');

class Warning {
	constructor(
		userId,
		userName,
		moderatorId,
		moderatorName,
		timestamp,
		privateReason,
		publicReason,
		reporterId,
		reporterName,
		pointsAdded,
	) {
		this._userId = userId;
		this._userName = userName;
		this._moderatorId = moderatorId;
		this._moderatorName = moderatorName;
		this._timestamp = timestamp;
		this._privateReason = privateReason;
		this._publicReason = publicReason;
		this._reporterId = reporterId;
		this._reporterName = reporterName;
		this._pointsAdded = pointsAdded;
	}

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
	 *
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
	 * Setter for moderator ID
	 *
	 * @param {String} moderatorId
	 */
	setModeratorId(moderatorId) {
		this._moderatorId = moderatorId;
	}

	/**
	 * Getter for moderator ID
	 *
	 * @returns {String}
	 */
	getModeratorId() {
		return this._moderatorId;
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
	 * Setter for private reason
	 *
	 * @param {String} privateReason
	 */
	setPrivateReason(privateReason) {
		this._privateReason = privateReason;
	}

	/**
	 * Getter for private reason
	 *
	 * @returns {String}
	 */
	getPrivateReason() {
		return this._privateReason;
	}

	/**
	 * Setter for public reason
	 *
	 * @param {String} publicReason
	 */
	setPublicReason(publicReason) {
		this._publicReason = publicReason;
	}

	/**
	 * Getter for public reason
	 *
	 * @returns {String}
	 */
	getPublicReason() {
		return this._publicReason;
	}

	/**
	 * Setter for reporter ID
	 *
	 * @param {String} reporterId
	 */
	setReporterId(reporterId) {
		this._reporterId = reporterId;
	}

	/**
	 * Getter for reporter ID
	 *
	 * @returns {String}
	 */
	getReporterId() {
		return this._reporterId;
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
	 * To string method to represent the Warning as an Embed
	 *
	 * @returns {Embed}
	 */
	generateEmbed() {
		const embed = new EmbedBuilder()
			.setTitle('User Warning')
			.addFields(
				{ name: 'User ID', value: String(this.getUserId()), inline: true },
				{ name: 'User Name', value: String(this.getUserName()), inline: true },
				{ name: 'Moderator ID', value: String(this.getModeratorId()), inline: true },
				{ name: 'Moderator Name', value: String(this.getModeratorName()), inline: true },
				{ name: 'Public Reason', value: String(this.getPublicReason() ?? ''), inline: false },
				{ name: 'Private Reason', value: String(this.getPrivateReason() ?? ''), inline: false },
				{ name: 'Reporter ID', value: String(this.getReporterId() ?? ''), inline: true },
				{ name: 'Reporter Name', value: String(this.getReporterName() ?? ''), inline: true },
				{ name: 'Points Added', value: String(this.getPointsAdded() ?? 0), inline: true },
				{ name: 'Is Ban', value: String(this.getIsBan()), inline: true },
				{ name: 'Timestamp', value: new Date(this.getTimestamp()).toISOString(), inline: false },
			)
			.setColor(0xffcc00);
		return embed;
	}
}

module.exports = Warning;
