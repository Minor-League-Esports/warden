const { EmbedBuilder } = require('discord.js');
const { chunkTextPreserveNewlines } = require('./UtilFunctions.js');

class CaseLogger {
	constructor(channel) {
		this._channel = channel;
	}

	async logWarn(warning, userNotify, fmNotify) {
		const kase = await this._getCase(warning.getCaseId());
		const embed = warning.generatePrivateEmbed(kase?.getCaseLink(), kase?.getReporterNames());
		embed.addFields({ name: 'FM Notified', value: String(fmNotify) });
		embed.addFields({ name: 'User Notified', value: String(userNotify) });
		this._channel.send({ embeds: [embed] });
	}

	async logPunishment(punishment, success, serverMap) {
		const kase = await this._getCase(punishment.getCaseId());
		const embed = punishment.generatePrivateEmbed(kase?.getCaseLink(), kase?.getReporterNames());
		embed.addFields({ name: 'User Notified', value: String(success) });
		embed.addFields({ name: 'Servers', value: this.getServerMapText(serverMap) });
		this._channel.send({ embeds: [embed] });
	}

	async _getCase(caseId) {
		if (!caseId || caseId === 'N/A') return null;
		try {
			return await globalThis.databaseManager.getCaseById(caseId);
		} catch (error) {
			logger.warn(`Failed to load case ${caseId} for case log: ${error}`);
			return null;
		}
	}

	logMute(user, moderator, serverMap, days, success) {
		const embed = this.createMuteEmbed(user, moderator, serverMap, days, success);
		this._channel.send({ embeds: [embed] });
	}

	logUnmute(user, moderator, serverMap, success) {
		const embed = this.createUnmuteEmbed(user, moderator, serverMap, success);
		this._channel.send({ embeds: [embed] });
	}

	logBan(user, moderator, serverMap) {
		const embed = this.createBanEmbed(user, moderator, serverMap);
		this._channel.send({ embeds: [embed] });
	}

	logUnban(user, moderator, serverMap) {
		const embed = this.createUnbanEmbed(user, moderator, serverMap);
		this._channel.send({ embeds: [embed] });
	}

	// logWarn(user, moderator, warnText, success, fmNotify) {
	// 	const embed = this.createWarnEmbed(user, moderator, warnText, success, fmNotify);
	// 	this._channel.send({ embeds: [embed] });
	// }

	createMuteEmbed(user, moderator, serverMap, days, success) {
		return new EmbedBuilder()
			.setColor('#ff761b')
			.setTitle(`${user.displayName} | Mute`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'Length', value: `${days} days`, inline: true },
				{ name: 'DM Success', value: success, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) },
			);
	}

	createUnmuteEmbed(user, moderator, serverMap, success) {
		return new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`${user.displayName} | Unmute`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'DM Success', value: success, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) },
			);
	}

	createBanEmbed(user, moderator, serverMap) {
		return new EmbedBuilder()
			.setColor('#ff0000')
			.setTitle(`${user.displayName} | Ban`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) },
			);
	}

	createUnbanEmbed(user, moderator, serverMap) {
		return new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`${user.displayName} | Unban`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) },
			);
	}

	createWarnEmbed(user, moderator, warnText, success, fmNotify) {
		const embed = new EmbedBuilder()
			.setColor('#ffe240')
			.setTitle(`${user.displayName} | Warn`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL());

		// Base fields (4 of 25 max)
		embed.addFields(
			{ name: 'User', value: `<@${user.id}>`, inline: true },
			{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
			{ name: 'User Notified', value: success },
			{ name: 'FM Notified', value: fmNotify },
		);

		const chunks = chunkTextPreserveNewlines(warnText, 1024);
		// remaining fields available
		const maxWarnFields = 25 - 4;

		let finalChunks = chunks;
		if (chunks.length > maxWarnFields) {
			finalChunks = chunks.slice(0, 25);
			const remainder = chunks.slice(24).join('');
			finalChunks[24] = remainder.length > 1024 ? remainder.slice(0, 1021) + '...' : remainder;
		}

		finalChunks.forEach((part, i) => {
			embed.addFields({
				name: i === 0 ? 'Reason' : `Reason (cont. ${i + 1})`,
				value: part,
			});
		});

		return embed;
	}

	getServerMapText(serverMap) {
		let returnString = '';
		serverMap.forEach((value, key) => {
			returnString += `${key}: ${value}\n`;
		});
		return returnString;
	}
}

module.exports = {
	CaseLogger,
};
