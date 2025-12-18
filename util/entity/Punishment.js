const { EmbedBuilder } = require('discord.js');

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
		} else if (this._type === 'unmute') {
			return 'Unmute within the MLE Community';
		} else if (this._type === 'unban') {
			return 'Unban from the MLE Community and League';
		} else {
			return 'Unknown';
		}
	}

	/**
	 * Generates an embed for moderator view of a standalone punishment
	 *
	 * @returns {EmbedBuilder}
	 */
	generatePrivateEmbed() {
		const embed = new EmbedBuilder()
			.setTitle(`${this.getUser()?.getUserName() ?? 'User'} | Punishment`)
			.setTimestamp(new Date(this.getTimestamp()))
			.addFields(
				{ name: 'Type', value: String(this.getType() ?? 'Unknown'), inline: true },
				{ name: 'Duration', value: String(this.getDuration() ?? 'N/A'), inline: true },
				{ name: 'Details', value: String(this.getFriendlyString() ?? 'None') },
				{ name: 'Moderator Name', value: String(this.getModerator()?.getUserName() ?? 'None'), inline: true },
			)
			.setFooter({ text: `ID: ${this.getUser()?.getDiscordId() ?? 'Unknown'}` })
			.setThumbnail(this.getUser()?.getDiscordAvatar() ?? null)
			.setColor('#ff0000');
		return embed;
	}

	generateUserEmbed() {
		let friendlyType;
		if (this._type === 'ban') {
			friendlyType = 'banned';
		} else if (this._type === 'mute') {
			friendlyType = 'muted';
		} else if (this._type === 'suspension') {
			friendlyType = 'suspended';
		} else if (this._type === 'unmute') {
			friendlyType = 'unmuted';
		} else if (this._type === 'unban') {
			friendlyType = 'unbanned';
		} else {
			friendlyType = 'punished';
		}
		const embed = new EmbedBuilder()
			.setTitle(`You have been ${friendlyType} by MLE Moderation`)
			.setTimestamp()
			.setColor('#ff0000')
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');

		if (this._type === 'mute') {
			embed.setDescription(`You have been muted in MLE for ${this._duration} day(s).`);
		} else if (this._type === 'suspension') {
			embed.setDescription(`You have been suspended from all MLE League Play for ${this._duration} week(s).`);
		} else if (this._type === 'ban') {
			embed.setDescription('You have been banned from the Minor League Esports Community and League.');
		} else if (this._type === 'unmute') {
			embed.setDescription('You have been unmuted in MLE.');
		} else if (this._type === 'unban') {
			embed.setDescription('You have been unbanned from the Minor League Esports Community and League.');
		} else {
			embed.setDescription('You have received a punishment from MLE Moderation.');
		}
		return embed;
	}
}

module.exports = Punishment;
