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
						.then(async function () {
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
	return new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('You have been warned')
		.setTimestamp()
		.setDescription(
			`You have been warned in MLE for the following reason: \n\n${warnText}`,
		);
}
