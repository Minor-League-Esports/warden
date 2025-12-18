class Punishment {
	/**
	 * Setter for punishment ID
	 *
	 * @param {String} punishmentId
	 */
	setPunishmentId(punishmentId) {
		this._punishmentId = punishmentId;
	}

	/**
	 * Getter for punishment ID
	 *
	 * @returns {String}
	 */
	getPunishmentId() {
		return this._punishmentId;
	}

	/**
	 * Setter for user object
	 *
	 * @param {User} user
	 */
	setUser(user) {
		this._user = user;
	}

	/**
	 * Getter for user object
	 *
	 * @returns {User}
	 */
	getUser() {
		return this._user;
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
	 * Setter for timestamp
	 *
	 * @param {Date} timestamp
	 */
	setTimestamp(timestamp) {
		this._timestamp = timestamp;
	}

	/**
	 * Getter for timestamp
	 *
	 * @returns {Date}
	 */
	getTimestamp() {
		return this._timestamp;
	}

	/**
	 * Setter for punishment type
	 *
	 * @param {String} type
	 */
	setType(type) {
		this._type = type;
	}

	/**
	 * Getter for punishment type
	 *
	 * @returns {String}
	 */
	getType() {
		return this._type;
	}

	/**
	 * Setter for duration
	 *
	 * @param {Number} duration
	 */
	setDuration(duration) {
		this._duration = duration;
	}

	/**
	 * Getter for duration
	 *
	 * @returns {Number}
	 */
	getDuration() {
		return this._duration;
	}

	/**
	 * Getter for friendly string
	 *
	 * @returns {String}
	 */
	getFriendlyString() {
		if (this._type === 'ban') {
			return `Ban from the Minor League Esports Community and League
            \nIf you wish to appeal this ban, you may do so in 6 months. 
            Any early appeals will be denied and you will not be able to appeal for another 180 days. 
            You can find the appeal form [at this link](<https://dyno.gg/form/28376717>).`;
		} else if (this._type === 'mute') {
			return `${this._duration} day mute within the MLE Community`;
		} else if (this._type === 'suspension') {
			return `${this._duration} week suspension from all MLE League Play`;
		} else if (this._type === 'warning') {
			return 'Official warning';
		}
	}
}

module.exports = Punishment;
