class User {
	constructor(userId, discordId, userName) {
		this._userId = userId;
		this._discordId = discordId;
		this._userName = userName;
	}

	/**
	 * Getter for user ID
	 * @returns {String}
	 */
	getUserId() {
		return this._userId;
	}

	/**
	 * Getter for Discord ID
	 * @returns {String}
	 */
	getDiscordId() {
		return this._discordId;
	}

	/**
	 * Getter for user name
	 * @returns {String}
	 */
	getUserName() {
		return this._userName;
	}
}

module.exports = User;
