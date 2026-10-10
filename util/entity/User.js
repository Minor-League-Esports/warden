const { EmbedBuilder } = require('discord.js');
const { calculateCurrentPoints, getNextPointExpiry } = require('../UtilFunctions.js');

class User {
	// Getters and setters
	setUserId(userId) {
		this._userId = userId;
	}

	getUserId() {
		return this._userId;
	}

	setDiscordId(discordId) {
		this._discordId = discordId;
	}

	getDiscordId() {
		return this._discordId;
	}

	// Users without a Discord account (e.g. reported by free-form name) can't be mentioned
	getDiscordMention() {
		if (this._discordId) return `<@${this._discordId}>`;
		return this.getDiscordUsername() ?? this.getAlternateIdentifier() ?? this.getUserName() ?? 'Unknown';
	}

	setDiscordAvatar(discordAvatar) {
		this._discordAvatar = discordAvatar;
	}

	getDiscordAvatar() {
		return this._discordAvatar ?? null;
	}

	setUserName(userName) {
		this._userName = userName;
	}

	getUserName() {
		return this._userName;
	}

	setDiscordUsername(discordUsername) {
		this._discordUsername = discordUsername;
	}

	getDiscordUsername() {
		return this._discordUsername ?? null;
	}

	setAlternateIdentifier(alternateIdentifier) {
		this._alternateIdentifier = alternateIdentifier;
	}

	getAlternateIdentifier() {
		return this._alternateIdentifier ?? null;
	}

	setMleId(mleId) {
		this._mleId = mleId;
	}

	getMleId() {
		return this._mleId ?? 'N/A';
	}

	/**
	 * Setter for warnings collection
	 * @param {Warning[]} warnings
	 */
	setWarnings(warnings) {
		this._warnings = warnings;
	}

	/**
	 * Getter for warnings collection
	 * @returns {Warning[]}
	 */
	getWarnings() {
		return this._warnings ?? [];
	}

	/**
	 * Setter for cases associated with the user
	 * @param {Case[]} cases
	 */
	setCases(cases) {
		this._cases = cases;
	}

	/**
	 * Getter for cases associated with the user
	 * @returns {Case[]}
	 */
	getCases() {
		return this._cases ?? [];
	}

	generateUserInfoEmbed() {
		return new EmbedBuilder()
			.setColor('#0000ff')
			.setTitle(`${this._userName} | Info`)
			.setFooter({ text: `ID: ${this.getDiscordId() ?? 'N/A'}` })
			.setTimestamp()
			.setThumbnail(this.getDiscordAvatar())
			.addFields(
				{ name: 'User Name', value: this.getUserName() },
				{ name: 'MLE ID', value: this.getMleId() },
				{ name: 'Discord User', value: this.getDiscordMention() },
				{ name: 'Discord Username', value: this.getDiscordUsername() ?? 'N/A' },
				{ name: 'Alternate Identifier', value: this.getAlternateIdentifier() ?? 'N/A' },
				{ name: 'Discord ID', value: String(this.getDiscordId() ?? 'N/A') },
				{ name: 'Warden ID', value: String(this.getUserId()) },
			);
	}

	generateUserSummaryEmbed() {
		const warnings = this.getWarnings();
		const cases = this.getCases();
		const currentPoints = calculateCurrentPoints(warnings);
		const expiry = getNextPointExpiry(warnings);
		const pointExpiration = expiry ? expiry.toISOString().slice(0, 10) : 'N/A';
		return new EmbedBuilder()
			.setColor('#ff761b')
			.setTitle(`${this._userName} | Summary`)
			.setFooter({ text: `ID: ${this._discordId ?? 'N/A'}` })
			.setTimestamp()
			.setThumbnail(this._discordAvatar)
			.addFields(
				{ name: 'User', value: this.getDiscordMention(), inline: true },
				{ name: 'MLE ID', value: this._mleId ?? 'N/A', inline: true },
				{
					name: 'Current Points',
					value: currentPoints > 0 ? `${currentPoints} (expires ${pointExpiration})` : 'No current points',
				},
				{
					name: 'Warnings',
					value: warnings.length > 0 ? `${warnings.length.toString()} warning(s) found` : 'No warnings found',
				},
				{
					name: 'Cases',
					value: cases.length > 0 ? `${cases.length.toString()} case(s) found` : 'No cases found',
				},
			);
	}
}

module.exports = User;
