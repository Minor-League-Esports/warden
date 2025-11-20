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

		const chunks = chunkTextPreserveNewlines(warnText, 1024);
		// remaining fields available
		const maxWarnFields = 25 - 3;

		let finalChunks = chunks;
		if (chunks.length > maxWarnFields) {
			finalChunks = chunks.slice(0, 25);
			const remainder = chunks.slice(24).join('');
			finalChunks[24] =
				remainder.length > 1024 ? remainder.slice(0, 1021) + '...' : remainder;
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

// Preserve newlines while chunking without breaking words (except ultra-long)
function chunkTextPreserveNewlines(text, max = 1024) {
	const chunks = [];
	let current = '';

	const lines = String(text).split(/\r?\n/);

	for (let li = 0; li < lines.length; li++) {
		const line = lines[li];

		// Handle completely empty line (just a newline)
		if (line === '') {
			// Add newline (if not last line)
			if (li < lines.length - 1) {
				if (current.length + 1 > max) {
					if (current) chunks.push(current);
					current = '';
				}
				current += '\n';
			}
			continue;
		}

		const words = line.split(/\s+/);

		for (let wi = 0; wi < words.length; wi++) {
			const word = words[wi];
			if (!word) continue;
			// space between words (not after newline or at start)
			const separatorNeeded =
				current.length && !current.endsWith('\n') && wi > 0 ? 1 : 0;

			const needed = current.length + separatorNeeded + word.length;

			if (needed > max) {
				if (current) chunks.push(current);
				current = '';
				// If word itself longer than max, hard-split
				if (word.length > max) {
					const pieces = word.match(new RegExp(`.{1,${max}}`, 'g'));
					while (pieces.length) {
						const piece = pieces.shift();
						if (piece.length === max) {
							chunks.push(piece);
						} else {
							current = piece;
							break;
						}
					}
					if (!current) current = '';
				} else {
					current = word;
				}
			} else {
				current += (separatorNeeded ? ' ' : '') + word;
			}
		}

		// Append newline if not last line
		if (li < lines.length - 1) {
			if (current.length + 1 > max) {
				if (current) chunks.push(current);
				current = '';
			}
			current += '\n';
		}
	}

	if (current) {
		// Remove trailing newline if it's the only character or at end
		if (current.endsWith('\n')) {
			// Keep intentional trailing newline if desired; usually safe to keep
		}
		chunks.push(current);
	}

	// Remove any empty chunks
	return chunks.filter((c) => c.length);
}

module.exports = {
	CaseLogger,
};
