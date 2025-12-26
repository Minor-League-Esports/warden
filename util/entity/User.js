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

	setMleId(mleId) {
		this._mleId = mleId;
	}

	getMleId() {
		return this._mleId ?? 'N/A';
	}

	generateUserInfoEmbed() {
		return new EmbedBuilder()
			.setColor('#0000ff')
			.setTitle(`${this._userName} | Info`)
			.setFooter({ text: `ID: ${this.getDiscordId()}` })
			.setTimestamp()
			.setThumbnail(this.getDiscordAvatar())
			.addFields(
				{ name: 'User Name', value: this.getUserName() },
				{ name: 'MLE ID', value: this.getMleId() },
				{ name: 'Discord User', value: `<@${this.getDiscordId()}>` },
				{ name: 'Discord ID', value: this.getDiscordId() },
				{ name: 'Warden ID', value: this.getUserId() },
			);
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
