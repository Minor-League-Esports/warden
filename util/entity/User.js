const { EmbedBuilder } = require('discord.js');
const { calculateCurrentPoints, getNextPointExpiry } = require('../UtilFunctions.js');

class User {
	constructor(userId, discordId, discordAvatar, userName, mleId) {
		this._userId = userId;
		this._discordId = discordId;
		this._discordAvatar = discordAvatar;
		this._userName = userName;
		this._mleId = mleId;
		this._warnings = [];
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

	/**
	 * Getter for MLE ID
	 * @returns {String}
	 */
	getMleId() {
		return this._mleId;
	}

	/**
	 * Getter for Warnings
	 * @returns {Warning[]}
	 */
	getWarnings() {
		return this._warnings;
	}

	/**
	 * Setter for Warnings
	 */
	setWarnings(warnings) {
		this._warnings = warnings;
	}

	/**
	 * Adds a Warning
	 */
	addWarning(warning) {
		this._warnings.push(warning);
	}

	generateUserSummaryEmbed() {
		const currentPoints = calculateCurrentPoints(this._warnings);
		const expiry = getNextPointExpiry(this._warnings);
		const pointExpiration = expiry ? expiry.toISOString().slice(0, 10) : 'N/A';
		return new EmbedBuilder()
			.setColor('#ff761b')
			.setTitle(`${this._userName} | Summary`)
			.setFooter({ text: `ID: ${this._discordId}` })
			.setTimestamp()
			.setThumbnail(this._discordAvatar)
			.addFields(
				{ name: 'User', value: `<@${this._discordId}>`, inline: true },
				{ name: 'MLE ID', value: this._mleId ?? 'N/A', inline: true },
				{ name: 'DB ID', value: this._userId.toString(), inline: true },
				{
					name: 'Current Points',
					value: currentPoints > 0 ? `${currentPoints} (expires ${pointExpiration})` : 'No current points',
				},
				{
					name: 'Warnings',
					value:
						this._warnings.length > 0 ? `${this._warnings.length.toString()} warning(s) found` : 'No warnings found',
				},
			);
	}
}

module.exports = User;
