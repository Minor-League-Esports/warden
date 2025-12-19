const log4js = require('log4js');
const logger = log4js.getLogger('PunishmentExecutor');
const { logLevel, guildList, announcementChannelId, mainGuild } = require('../config.json');
logger.level = logLevel;

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class PunishmentExecutor {
	constructor(discordClient, caseLogger) {
		this._discordClient = discordClient;
		this._caseLogger = caseLogger;
	}

	async execute(dbUserId, warnCreatorId, punishmentExecutorId, proposalEmbed, action) {
		const parsedEmbed = this.parseProposedEmbed(proposalEmbed);
		try {
			// Create the warning in the database
			const warning = await globalThis.databaseManager.createWarning(
				dbUserId,
				warnCreatorId,
				parsedEmbed.reporter,
				parsedEmbed.rulesBroken,
				parsedEmbed.violatingContent,
				parsedEmbed.pointsAdded,
				parsedEmbed.moderatorNotes,
			);

			logger.debug(`Created warning with ID: ${warning.getWarningId()} for user ID: ${dbUserId}`);
			const punishments = [];
			// For each punishment in the action string, create the punishment and link it to the warning
			for (const pun of action.split(';')) {
				const [type, durationStr] = pun.split('=');
				// Create the punishment in the database
				const punishment = await globalThis.databaseManager.createPunishment(
					dbUserId,
					punishmentExecutorId,
					type,
					durationStr ? Number.parseInt(durationStr, 10) : null,
				);
				logger.debug(
					`Created punishment with ID: ${punishment.getPunishmentId()} of type: ${type} for user ID: ${dbUserId}`,
				);
				punishments.push(punishment);

				// Link the warning and punishment in the database
				await globalThis.databaseManager.createWarningPunishmentLink(
					warning.getWarningId(),
					punishment.getPunishmentId(),
				);
			}

			// Now we can execute the warning
			// Can't do it earlier because the warning needs to have a record of the punishments linked to it
			try {
				const newWarning = await globalThis.databaseManager.getWarnings(dbUserId, 1);
				await this.executeWarn(newWarning[0]);
			} catch (warnError) {
				logger.error(`Error sending warning to user ID ${parsedEmbed.userDiscordId}: ${warnError}`);
				throw warnError;
			}

			// Normalize probation status from the proposed embed (string -> boolean/undefined)
			const normalizeOnProbation = (val) => {
				if (typeof val === 'boolean') return val;
				if (typeof val === 'string') {
					const s = val.trim().toLowerCase();
					if (s === 'true' || s === 'yes') return true;
					if (s === 'false' || s === 'no') return false;
				}
				return undefined;
			};
			const parsedOnProbation = normalizeOnProbation(parsedEmbed.onProbation);

			// Now execute all punishments
			for (const punishment of punishments) {
				if (punishment.getType() === 'suspension') {
					// Warden can't execute suspensions yet
					continue;
				}
				try {
					await this.executePunishment(punishment, { onProbationOverride: parsedOnProbation });
				} catch (punishmentError) {
					logger.error(
						`Error executing punishment ID ${punishment.getPunishmentId()} for user ID ${dbUserId}: ${punishmentError}`,
					);
					throw punishmentError;
				}
			}
		} catch (error) {
			logger.error(`Error executing punishment for user ID ${dbUserId}: ${error}`);
			throw error;
		}
	}

	async executeWarn(warning) {
		const userDiscordId = warning.getUser().getDiscordId();
		const userName = warning.getUser().getUserName();
		try {
			const user = await this._discordClient.users.fetch(userDiscordId);
			const userEmbed = warning.generateUserEmbed();
			const fmDiscordId = await globalThis.dataParser.getPlayerFranchiseManagerDiscordIdByDiscordId(userDiscordId);
			const fmName = await globalThis.dataParser.getMemberNameByDiscordId(fmDiscordId);
			await user.send({ embeds: [userEmbed] });
			if (fmDiscordId) {
				const fmUser = await this._discordClient.users.fetch(fmDiscordId);
				const fmEmbed = EmbedBuilder.from(userEmbed)
					.setTitle(`Franchise Manager Notice: ${userEmbed.title}`)
					.setDescription(
						`This is to notify you that your franchise member, ${userName}, has been issued a warning.\n\n` +
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
			await globalThis.caseLogger.logWarn(warning, false, 'N/A');
			if (error.code === 50007) {
				throw new Error(`Failed to send warning to ${userName}\nUser has DMs disabled or the bot is blocked`);
			} else {
				logger.error(error);
				await globalThis.discordLogger.logMessage(`Error messaging ${userName}!\n\`\`\`\n${error}\n\`\`\``);
				throw new Error(`Failed to send warning to ${userName}, reason unknown`);
			}
		}
	}

	async executePunishment(punishment, options = {}) {
		const punishmentId = punishment.getPunishmentId();
		const punishmentType = punishment.getType();
		const punishmentDuration = punishment.getDuration();
		const userDiscordId = punishment.getUser().getDiscordId();
		const userName = punishment.getUser().getUserName();
		const servers = new Map();
		let successCount = 0;

		// Determine probation status before executing any guild actions
		let onProbation = undefined;
		if (typeof options.onProbationOverride === 'boolean') {
			onProbation = options.onProbationOverride;
		} else {
			try {
				const mainServer = this._discordClient.guilds.cache.get(mainGuild);
				if (mainServer) {
					const member = await mainServer.members.fetch(userDiscordId);
					const joinedAt = member?.joinedAt;
					if (joinedAt) {
						const daysSinceJoin = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
						onProbation = daysSinceJoin < 90;
					}
				}
			} catch (_) {
				// leave undefined if lookup fails
				_;
			}
		}

		// Do the punishment in discord across all guilds
		// Promise.all to do them all concurrently
		await Promise.all(
			guildList.map(async (guildId) => {
				const guild = this._discordClient.guilds.cache.get(guildId);
				// Try to get server
				if (guild === undefined) {
					servers.set(guildId, 'Error getting server');
				} else {
					// Check for permission
					if (punishmentType === 'mute' || punishmentType === 'unmute') {
						if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
							servers.set(guild.name, 'No permission');
							return;
						}
					} else if (punishmentType === 'ban' || punishmentType === 'unban') {
						if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
							servers.set(guild.name, 'No permission');
							return;
						}
					} else if (punishmentType === 'kick') {
						if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
							servers.set(guild.name, 'No permission');
							return;
						}
					}

					// Punishments where the member is already in the server
					if (punishmentType === 'mute' || punishmentType === 'unmute' || punishmentType === 'kick') {
						try {
							// Try to get member
							const member = await guild.members.fetch(userDiscordId);

							try {
								// Try to timeout member
								if (punishmentType === 'mute') {
									await member.timeout(
										punishmentDuration * 24 * 60 * 60 * 1000,
										`Warden Punishment ID: ${punishmentId}`,
									);
								} else if (punishmentType === 'unmute') {
									await member.timeout(1, `Warden Punishment ID: ${punishmentId}`);
								} else {
									await member.kick(`Warden Punishment ID: ${punishmentId}`);
								}
								servers.set(guild.name, 'Success');
								successCount++;
							} catch (error) {
								logger.error(error);
								// Failed to timeout member
								servers.set(guild.name, 'Error');

								await globalThis.discordLogger.logMessage(
									`Error punishing ${userName} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
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
									`Error fetching member ${userDiscordId} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}
						}
					} else if (punishmentType === 'ban' || punishmentType === 'unban') {
						// Punishments where the member may not be in the server
						try {
							if (punishmentType === 'ban') {
								await guild.members.ban(userDiscordId, { reason: `Warden Punishment ID: ${punishmentId}` });
							} else if (punishmentType === 'unban') {
								await guild.members.unban(userDiscordId, { reason: `Warden Punishment ID: ${punishmentId}` });
							}
							servers.set(guild.name, 'Success');
							successCount++;
						} catch (error) {
							logger.error(error);
							servers.set(guild.name, 'Error banning/unbanning member');
							await globalThis.discordLogger.logMessage(
								`Error banning/unbanning ${userName} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``,
							);
						}
					} else {
						servers.set(guild.name, 'Unknown punishment type');
					}
				}
			}),
		);

		logger.debug(`Execution results for ${userDiscordId}: ${JSON.stringify(Array.from(servers.entries()))}`);

		// Check if it succeeded in any servers
		if (successCount === 0) {
			throw new Error('Failed to punish user in any MLE servers');
		} else {
			// If it succeeded, send a notice to user
			try {
				const user = await this._discordClient.users.fetch(userDiscordId);
				await user.send({ embeds: [punishment.generateUserEmbed()] });
				await globalThis.caseLogger.logPunishment(punishment, 'True', servers);
			} catch (error) {
				// Send failed
				// Log it
				logger.error(error);
				await globalThis.caseLogger.logPunishment(punishment, 'False', servers);
				if (error.code === 50007) {
					throw new Error(
						`Failed to send punishment notice to ${userName}\nUser has DMs disabled or the bot is blocked`,
					);
				} else {
					logger.error(error);
					await globalThis.discordLogger.logMessage(`Error messaging ${userName}!\n\`\`\`\n${error}\n\`\`\``);
					throw new Error(`Failed to send punishment notice to ${userName}, reason unknown`);
				}
			} finally {
				// Announce in announcement channel
				if (punishmentType === 'ban') {
					const announcementChannel = await this._discordClient.channels.fetch(announcementChannelId);
					if (announcementChannel && announcementChannel.isTextBased()) {
						const announcementEmbed = await punishment.generateAnnouncementEmbed({ onProbation: Boolean(onProbation) });
						await announcementChannel.send({ embeds: [announcementEmbed] });
					}
				}
			}
		}
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
