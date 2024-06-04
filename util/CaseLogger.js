const { EmbedBuilder } = require('discord.js');

class CaseLogger {
	constructor(channel) {
		this._channel = channel;
	}

	logMute(user, moderator, serverMap, days) {
		const embed = this.createMuteEmbed(user, moderator, serverMap, days);
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

	createMuteEmbed(user, moderator, serverMap, days) {
		const muteEmbed = new EmbedBuilder()
			.setColor('#ff761b')
			.setTitle(`${user.displayName} | Mute`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'Length', value: `${days} days`, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) }
			);
		return muteEmbed;
	}

	createBanEmbed(user, moderator, serverMap) {
		const banEmbed = new EmbedBuilder()
			.setColor('#ff0000')
			.setTitle(`${user.displayName} | Ban`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) }
			);
		return banEmbed;
	}

	createUnbanEmbed(user, moderator, serverMap) {
		const unbanEmbed = new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle(`${user.displayName} | Unban`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'Servers', value: this.getServerMapText(serverMap) }
			);
		return unbanEmbed;
	}

	createWarnEmbed(user, moderator, warnText, success) {
		const warnEmbed = new EmbedBuilder()
			.setColor('#ffe240')
			.setTitle(`${user.displayName} | Warn`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL())
			.addFields(
				{ name: 'User', value: `<@${user.id}>`, inline: true },
				{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
				{ name: 'DM Success', value: success, inline: true },
				{ name: 'Warn Text', value: warnText }
			);
		return warnEmbed;
	}

	getServerMapText(serverMap) {
		let returnString = '';
		serverMap.forEach(function (value, key) {
			returnString += `${key}: ${value}\n`;
		});
		return returnString;
	}
}

module.exports = {
	CaseLogger
};
