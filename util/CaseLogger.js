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
		const embed = new EmbedBuilder()
			.setColor('#ffe240')
			.setTitle(`${user.displayName} | Warn`)
			.setFooter({ text: `ID: ${user.id}` })
			.setTimestamp()
			.setThumbnail(user.displayAvatarURL());

		// Base fields (3 of 25 max)
		embed.addFields(
			{ name: 'User', value: `<@${user.id}>`, inline: true },
			{ name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
			{ name: 'DM Success', value: success, inline: true },
		);

		const chunks = chunkText(warnText, 1024);
		const maxWarnFields = 25 - 3; // remaining fields available

		let finalChunks = chunks;
		if (chunks.length > maxWarnFields) {
			finalChunks = chunks.slice(0, maxWarnFields);
			// Merge remaining into last warn field and truncate if necessary
			const remainder = chunks.slice(maxWarnFields - 1).join(' ');
			finalChunks[maxWarnFields - 1] =
				remainder.length > 1024 ? remainder.slice(0, 1021) + '...' : remainder;
		}

		finalChunks.forEach((part, i) => {
			embed.addFields({
				name: i === 0 ? 'Warn Text' : `Warn Text (cont. ${i + 1})`,
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

function chunkText(text, max = 1024) {
	const words = String(text).split(/\s+/);
	const chunks = [];
	let current = '';

	for (const word of words) {
		if (!word) continue;
		const needed = (current.length ? current.length + 1 : 0) + word.length;
		if (needed > max) {
			if (current) chunks.push(current);
			if (word.length > max) {
				const pieces = word.match(new RegExp(`.{1,${max}}`, 'g'));
				current = pieces.shift();
				chunks.push(...pieces.slice(0, -1));
				const last = pieces[pieces.length - 1];
				if (last) {
					if (last.length === max) {
						chunks.push(last);
						current = '';
					} else {
						current = last;
					}
				}
			} else {
				current = word;
			}
		} else {
			current += (current.length ? ' ' : '') + word;
		}
	}

	if (current) chunks.push(current);
	return chunks;
}

module.exports = {
	CaseLogger,
};
