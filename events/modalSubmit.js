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

			const userId = interaction.fields.getTextInputValue('userId');

			interaction.client.users
				.fetch(userId)
				.then(async function (user) {
					const logChannel = await interaction.client.channels.fetch(opsLogChannelId);
					const logger = new Logger(logChannel);
					const caseLogChannel = await interaction.client.channels.fetch(caseLogChannelId);
					const caseLogger = new CaseLogger(caseLogChannel);

					const warnText = interaction.fields.getTextInputValue('warnText');
					const warnEmbed = createEmbed(warnText);

					user
						.send({ embeds: [warnEmbed] })
						.then(async function () {
							await interaction.editReply(`Successfully warned ${user.displayName}`);
							caseLogger.logWarn(user, interaction.user, warnText, 'True');
						})
						.catch(async function (error) {
							if (error.code === 50007) {
								await interaction.editReply(
									`Failed to warn ${user.displayName}\nUser has DMs disabled or the bot is blocked`
								);
							} else {
								await interaction.editReply(`Failed to warn ${user.displayName}, reason unknown`);
								logger.logMessage(`Error messaging ${user}!\n\`\`\`\n${error}\n\`\`\``);
							}

							caseLogger.logWarn(user, interaction.user, warnText, 'False');
						});
				})
				.catch(async function (error) {
					if (error.code === 10013) {
						await interaction.editReply(`Failed to find user with ID ${userId}`);
					} else {
						await interaction.editReply('An unknown error occurred');
						logger.logMessage(`Unknown error warning ${userId}!\n\`\`\`\n${error}\n\`\`\``);
					}
				});
		}
	}
};

function createEmbed(warnText) {
	return new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle(`You have been warned`)
		.setTimestamp()
		.setDescription(`You have been warned in MLE for the following reason: \n\n${warnText}`);
}
