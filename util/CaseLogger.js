const { EmbedBuilder } = require('discord.js');

class CaseLogger {
	constructor(channel) {
		this._channel = channel;
	}

	logMute(user, moderator, serverMap, days, success) {
		const embed = this.createMuteEmbed(
			user,
			moderator,
			serverMap,
			days,
			success,
		);
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

	logWarn(user, moderator, warnText, success) {
		const embed = this.createWarnEmbed(user, moderator, warnText, success);
		this._channel.send({ embeds: [embed] });
	}

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

	createWarnEmbed(user, moderator, warnText, success) {
		return new EmbedBuilder()
			.setColor('#ffe240')
			.setTitle(`${user.displayName} | Warn`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'DM Success', value: success, inline: true },
				{ name: 'Warn Text', value: warnText },
			);
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
