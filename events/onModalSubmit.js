const log4js = require('log4js');
const logger = log4js.getLogger('onModalSubmit');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events, EmbedBuilder } = require('discord.js');
const { chunkTextPreserveNewlines } = require('../util/UtilFunctions.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		if (interaction.customId === 'warnModal') {
			await interaction.deferReply();

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

							notifyFmAndLog(user, warnText, interaction, globalThis.caseLogger, globalThis.discordLogger);
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
								globalThis.discordLogger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}

							// Log it
							globalThis.caseLogger.logWarn(user, interaction.user, warnText, 'Failed', 'N/A');
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
						globalThis.discordLogger.logMessage(`Unknown error warning ${userId}!\n\`\`\`\n${error}\n\`\`\``);
					}
				});
		}
	},
};

async function notifyFmAndLog(user, warnText, interaction, caseLogger, discordLogger) {
	// Get data parser for notifying FMs
	const fmDiscordId = await globalThis.dataParser.getPlayerFranchiseManagerDiscordIdByDiscordId(user.id);
	const fmName = await globalThis.dataParser.getMemberNameByDiscordId(fmDiscordId);
	const warnedMemberName = (await globalThis.dataParser.getMemberNameByDiscordId(user.id)) ?? user.displayName;

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
