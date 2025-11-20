const { Events, EmbedBuilder } = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { CaseLogger } = require('../util/CaseLogger.js');
const { opsLogChannelId, caseLogChannelId } = require('../config.json');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		if (interaction.customId === 'warnModal') {
			await interaction.deferReply();

			// Fetch the user
			const userId = interaction.fields.getTextInputValue('userId');

			// Set up loggers
			const logChannel = await interaction.client.channels.fetch(
				opsLogChannelId,
			);
			const logger = new Logger(logChannel);
			const caseLogChannel = await interaction.client.channels.fetch(
				caseLogChannelId,
			);
			const caseLogger = new CaseLogger(caseLogChannel);

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
							// Log it
							caseLogger.logWarn(user, interaction.user, warnText, 'True');
						})
						.catch(async (error) => {
							// Warn failed
							if (error.code === 50007) {
								await interaction.editReply({
									content: `Failed to warn ${user.displayName}\nUser has DMs disabled or the bot is blocked`,
								});
							} else {
								console.error(error);
								await interaction.editReply({
									content: `Failed to warn ${user.displayName}, reason unknown`,
								});
								logger.logMessage(
									`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``,
								);
							}

							// Log it
							caseLogger.logWarn(user, interaction.user, warnText, 'False');
						});
				})
				.catch(async (error) => {
					// Failed to fetch user
					if (error.code === 10013) {
						await interaction.editReply({
							content: `Failed to find user with ID ${userId}`,
						});
					} else {
						console.error(error);
						await interaction.editReply({
							content: 'An unknown error occurred',
						});
						logger.logMessage(
							`Unknown error warning ${userId}!\n\`\`\`\n${error}\n\`\`\``,
						);
					}
				});
		}
	},
};

function createEmbed(warnText) {
	const embed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('You have been warned')
		.setTimestamp();

	const chunks = chunkText(warnText, 1024);

	// Enforce Discord max 25 fields
	let finalChunks = chunks;
	if (chunks.length > 25) {
		finalChunks = chunks.slice(0, 25);
		// Merge remaining into last field and truncate if needed
		const remainder = chunks.slice(24).join(' ');
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

function chunkText(text, max = 1024) {
	// Split on whitespace while preserving word integrity
	const words = text.split(/\s+/);
	const chunks = [];
	let current = '';

	for (const word of words) {
		if (!word) continue;
		const needed = (current.length ? current.length + 1 : 0) + word.length;
		if (needed > max) {
			if (current) chunks.push(current);
			// If single word exceeds max (very long), hard-split it
			if (word.length > max) {
				const pieces = word.match(new RegExp(`.{1,${max}}`, 'g'));
				// First piece starts new current; others become full chunks except last
				current = pieces.shift();
				chunks.push(...pieces.slice(0, -1));
				if (pieces.length) {
					const last = pieces[pieces.length - 1];
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
