const log4js = require('log4js');
const logger = log4js.getLogger('PunishmentExecutor');
const { logLevel, guildList } = require('../config.json');
logger.level = logLevel;

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class PunishmentExecutor {
	constructor(discordClient, caseLogger) {
		this._discordClient = discordClient;
		this._caseLogger = caseLogger;
	}

	async executePunishment(dbUserId, moderatorId, proposalEmbed, action) {
		const parsedEmbed = this.parseProposedEmbed(proposalEmbed);
		try {
			// Create the warning in the database
			const warning = await globalThis.databaseManager.createWarning(
				dbUserId,
				moderatorId,
				parsedEmbed.reporter,
				parsedEmbed.rulesBroken,
				parsedEmbed.violatingContent,
				parsedEmbed.pointsAdded,
				parsedEmbed.moderatorNotes,
			);

			logger.debug(`Created warning with ID: ${warning.getWarningId()} for user ID: ${dbUserId}`);
			for (const pun of action.split(';')) {
				const [type, durationStr] = pun.split('=');
				// Create the punishment in the database
				const punishment = await globalThis.databaseManager.createPunishment(
					dbUserId,
					moderatorId,
					type,
					durationStr ? Number.parseInt(durationStr, 10) : null,
				);
				logger.debug(
					`Created punishment with ID: ${punishment.getPunishmentId()} of type: ${type} for user ID: ${dbUserId}`,
				);

				// Link the warning and punishment in the database
				await globalThis.databaseManager.createWarningPunishmentLink(
					warning.getWarningId(),
					punishment.getPunishmentId(),
				);

				if (type === 'mute') {
					const durationDays = durationStr ? Number.parseInt(durationStr, 10) : 0;
					await this.executeMute(parsedEmbed.userDiscordId, durationDays, punishment);
				}
			}

			// Now we can execute the warning
			// Can't do it earlier because the warning needs to have a record of the punishments linked to it
			try {
				const newWarning = await globalThis.databaseManager.getWarnings(dbUserId, 1);
				await this.executeWarn(parsedEmbed.userDiscordId, newWarning[0]);
			} catch (warnError) {
				logger.error(`Error sending warning to user ID ${parsedEmbed.userDiscordId}: ${warnError}`);
				throw warnError;
			}
		} catch (error) {
			logger.error(`Error executing punishment for user ID ${dbUserId}: ${error}`);
			throw error;
		}
	}

	async executeWarn(discordId, warning) {
		try {
			const user = await this._discordClient.users.fetch(discordId);
			const userEmbed = warning.generateUserEmbed();
			const fmDiscordId = await globalThis.dataParser.getPlayerFranchiseManagerDiscordIdByDiscordId(discordId);
			const fmName = await globalThis.dataParser.getMemberNameByDiscordId(fmDiscordId);
			await user.send({ embeds: [userEmbed] });
			if (fmDiscordId) {
				const fmUser = await this._discordClient.users.fetch(fmDiscordId);
				const fmEmbed = EmbedBuilder.from(userEmbed)
					.setTitle(`Franchise Manager Notice: ${userEmbed.title}`)
					.setDescription(
						`This is to notify you that your franchise member, ${user.displayName}, has been issued a warning.\n\n` +
							userEmbed.description,
					);
				await fmUser.send({ embeds: [fmEmbed] });
				await globalThis.caseLogger.logWarn(warning, true, fmName);
			} else {
				await globalThis.caseLogger.logWarn(warning, true, 'N/A');
			}
		} catch (error) {
			// Send failed
			// Log it
			logger.error(error);
			await globalThis.caseLogger.logWarn(warning, false, 'N/A');
			if (error.code === 50007) {
				throw new Error(`Failed to send mute notice to ${discordId}\nUser has DMs disabled or the bot is blocked`);
			} else {
				logger.error(error);
				await globalThis.discordLogger.logMessage(`Error messaging ${discordId}!\n\`\`\`\n${error}\n\`\`\``);
				throw new Error(`Failed to send mute notice to ${discordId}, reason unknown`);
			}
		}
	}

	async executeMute(discordId, duration, punishment) {
		const servers = new Map();
		let successCount = 0;

		await Promise.all(
			guildList.map(async (guildId) => {
				const guild = this._discordClient.guilds.cache.get(guildId);
				// Try to get server
				if (guild === undefined) {
					servers.set(guildId, 'Error getting server');
				} else {
					// Check for permission
					if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
						servers.set(guild.name, 'No permission');
						return;
					}

					try {
						// Try to get member
						const member = await guild.members.fetch(discordId);

						try {
							// Try to timeout member
							await member.timeout(duration * 24 * 60 * 60 * 1000);
							servers.set(guild.name, 'Success');
							successCount++;
						} catch (error) {
							logger.error(error);
							// Failed to timeout member
							servers.set(guild.name, 'Error timing out member');

							await globalThis.discordLogger.logMessage(
								`Error timing out ${discordId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
							);
						}
					} catch (error) {
						// Failed to get member
						if (error.code === 10007) {
							servers.set(guild.name, 'Not in server');
						} else {
							logger.error(error);
							servers.set(guild.name, 'Error getting member');
							await globalThis.discordLogger.logMessage(
								`Error fetching member ${discordId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
							);
						}
					}
				}
			}),
		);

		logger.debug(`Mute execution results for ${discordId}: ${JSON.stringify(Array.from(servers.entries()))}`);

		// Check if it succeeded in any servers
		if (successCount === 0) {
			throw new Error('Failed to mute user in any MLE servers');
		} else {
			// If it succeeded, send a notice to user
			try {
				const embed = this.createMuteEmbed(duration);
				const user = await this._discordClient.users.fetch(discordId);
				await user.send({ embeds: [embed] });
				await globalThis.caseLogger.logPunishment(punishment, 'True', servers);
			} catch (error) {
				// Send failed
				// Log it
				logger.error(error);
				await globalThis.caseLogger.logPunishment(punishment, 'False', servers);
				if (error.code === 50007) {
					throw new Error(`Failed to send mute notice to ${discordId}\nUser has DMs disabled or the bot is blocked`);
				} else {
					logger.error(error);
					await globalThis.discordLogger.logMessage(`Error messaging ${discordId}!\n\`\`\`\n${error}\n\`\`\``);
					throw new Error(`Failed to send mute notice to ${discordId}, reason unknown`);
				}
			}
		}
	}

	createMuteEmbed(days) {
		return new EmbedBuilder()
			.setColor('#ff0000')
			.setTitle('You have been muted')
			.setTimestamp()
			.setDescription(`You have been muted in MLE for ${days} days`)
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');
	}

	parseProposedEmbed(proposalEmbed) {
		const userName = proposalEmbed.title.split(' ')[0];
		const userDiscordId = proposalEmbed.footer.text.split('ID: ')[1];
		const mleIdField = proposalEmbed.fields.find((field) => field.name === 'MLE ID');
		const mleId = mleIdField ? mleIdField.value : 'N/A';
		const onProbationField = proposalEmbed.fields.find((field) => field.name === 'On Probation');
		const onProbation = onProbationField ? onProbationField.value : 'Unknown';
		const rulesBrokenField = proposalEmbed.fields.find((field) => field.name === 'Rule(s) Broken');
		const rulesBroken = rulesBrokenField ? rulesBrokenField.value : 'Not specified';
		const violatingContentField = proposalEmbed.fields.find((field) => field.name === 'Violating Content');
		const violatingContent = violatingContentField ? violatingContentField.value : 'Not specified';
		const pointsAddedField = proposalEmbed.fields.find((field) => field.name === 'Points Added');
		const pointsAdded = pointsAddedField ? parseInt(pointsAddedField.value, 10) : 0;
		const totalPointsField = proposalEmbed.fields.find((field) => field.name === 'New Points Total');
		const totalPoints = totalPointsField ? parseInt(totalPointsField.value, 10) : 0;
		const moderatorNotesField = proposalEmbed.fields.find((field) => field.name === 'Moderator Notes');
		const moderatorNotes = moderatorNotesField ? moderatorNotesField.value : 'None';
		const reporterField = proposalEmbed.fields.find((field) => field.name === 'Reporter');
		const reporter = reporterField?.value.split(':')[1] || null;

		return {
			userName,
			userDiscordId,
			mleId,
			onProbation,
			rulesBroken,
			violatingContent,
			pointsAdded,
			totalPoints,
			moderatorNotes,
			reporter,
		};
	}
}

module.exports = { PunishmentExecutor };
