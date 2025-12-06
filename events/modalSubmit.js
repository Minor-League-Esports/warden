const log4js = require('log4js');
const logger = log4js.getLogger('ModalSubmit');
const { logLevel, opsLogChannelId, caseLogChannelId } = require('../config.json');
logger.level = logLevel;

const { Events, EmbedBuilder } = require('discord.js');
const { DiscordLogger } = require('../util/DiscordLogger');
const { CaseLogger } = require('../util/CaseLogger.js');
const { getDataParser } = require('../util/dataParserSingleton');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		if (interaction.customId === 'warnModal') {
			await interaction.deferReply();

			// Set up loggers
			const client = interaction.client;
			const discordLogger = new DiscordLogger(client, opsLogChannelId);
			try {
				await discordLogger.init();
			} catch (error) {
				logger.warn('Failed to initialize DiscordLogger', error);
			}

			const caseLogChannel = await interaction.client.channels.fetch(caseLogChannelId);
			const caseLogger = new CaseLogger(caseLogChannel);

			// Fetch the user
			const userId = interaction.fields.getTextInputValue('userId');

			interaction.client.users
				.fetch(userId)
				.then(async (user) => {
					// Create embed
					const warnText = interaction.fields.getTextInputValue('warnText');
					const warnEmbed = createEmbed(warnText);

					// Try to send
					user
						.send({ embeds: [warnEmbed] })
						.then(async () => {
							// Warn success
							await interaction.editReply({
								content: `Successfully warned ${user.displayName}`,
							});

							notifyFmAndLog(user, warnText, interaction, caseLogger, discordLogger);
						})
						.catch(async (error) => {
							// Warn failed
							if (error.code === 50007) {
								await interaction.editReply({
									content: `Failed to warn ${user.displayName}\nUser has DMs disabled or the bot is blocked`,
								});
							} else {
								logger.error(error);
								await interaction.editReply({
									content: `Failed to warn ${user.displayName}, reason unknown`,
								});
								discordLogger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}

							// Log it
							caseLogger.logWarn(user, interaction.user, warnText, 'Failed', 'N/A');
						});
				})
				.catch(async (error) => {
					// Failed to fetch user
					if (error.code === 10013) {
						await interaction.editReply({
							content: `Failed to find user with ID ${userId}`,
						});
					} else {
						logger.error(error);
						await interaction.editReply({
							content: 'An unknown error occurred',
						});
						discordLogger.logMessage(`Unknown error warning ${userId}!\n\`\`\`\n${error}\n\`\`\``);
					}
				});
		}
	},
};

async function notifyFmAndLog(user, warnText, interaction, caseLogger, discordLogger) {
	// Get data parser for notifying FMs
	const dataParser = await getDataParser(interaction.client);
	const fmDiscordId = await dataParser.getPlayerFranchiseManagerDiscordIdByDiscordId(user.id);
	const fmName = await dataParser.getMemberNameByDiscordId(fmDiscordId);
	const warnedMemberName = (await dataParser.getMemberNameByDiscordId(user.id)) ?? user.displayName;

	if (fmDiscordId && fmDiscordId != user.id) {
		// Notify FM of the warning
		interaction.client.users
			.fetch(fmDiscordId)
			.then(async (fmUser) => {
				// Create embed
				const fmNoticeEmbed = createFmNoticeEmbed(warnText, warnedMemberName);

				// Try to send
				fmUser
					.send({ embeds: [fmNoticeEmbed] })
					.then(async () => {
						// Warn success
						await interaction.followUp({
							content: `Successfully notified FM ${fmName}`,
						});
						// Log it
						caseLogger.logWarn(user, interaction.user, warnText, 'True', fmName);
					})
					.catch(async (error) => {
						// Warn failed
						if (error.code === 50007) {
							await interaction.followUp({
								content: `Failed to send notice to FM ${fmName}\nUser has DMs disabled or the bot is blocked`,
							});
						} else {
							logger.error(error);
							await interaction.followUp({
								content: `Failed to send notice to FM ${fmName}, reason unknown`,
							});
							discordLogger.logMessage(`Error messaging ${fmName} (${fmDiscordId})!\n\`\`\`\n${error}\n\`\`\``);
						}

						// Log it
						caseLogger.logWarn(user, interaction.user, warnText, 'True', 'Failed');
					});
			})
			.catch(async (error) => {
				// Failed to fetch user
				if (error.code === 10013) {
					await interaction.followUp({
						content: `Failed to find FM user with ID ${fmDiscordId}`,
					});
				} else {
					logger.error(error);
					await interaction.followUp({
						content: `An unknown error occurred finding FM user with ID ${fmDiscordId}`,
					});
					discordLogger.logMessage(`Unknown error notifying ${fmName} (${fmDiscordId})!\n\`\`\`\n${error}\n\`\`\``);
				}

				// Log it
				caseLogger.logWarn(user, interaction.user, warnText, 'True', 'Failed');
			});
	} else {
		// No FM to notify, just log it
		// Log it
		caseLogger.logWarn(user, interaction.user, warnText, 'True', 'N/A');
	}
}

function createFmNoticeEmbed(warnText, playerName) {
	const embed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle(`Your player ${playerName} has recieved an official warning from MLE Moderation`)
		.setTimestamp()
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');

	const chunks = chunkTextPreserveNewlines(warnText, 1024);

	let finalChunks = chunks;
	if (chunks.length > 25) {
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

function createEmbed(warnText) {
	const embed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('You have recieved an official warning from MLE Moderation')
		.setTimestamp()
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');

	const chunks = chunkTextPreserveNewlines(warnText, 1024);

	let finalChunks = chunks;
	if (chunks.length > 25) {
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
			const separatorNeeded = current.length && !current.endsWith('\n') && wi > 0 ? 1 : 0;

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
