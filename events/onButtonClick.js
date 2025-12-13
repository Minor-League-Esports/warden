const log4js = require('log4js');
const logger = log4js.getLogger('onButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;
		const buttonMessage = interaction.message;

		if (buttonId === 'userViewHistoryButton') {
			await interaction.deferReply();
			const embeds = buttonMessage.embeds;
			if (embeds.length === 0) {
				await interaction.editReply({
					content: 'No user information found in the message.',
				});
				return;
			}
			if (embeds.length > 1) {
				await interaction.editReply({
					content: 'Multiple embeds found in the message; cannot determine user.',
				});
				return;
			}
			const userIdField = embeds[0].data.fields.find((field) => field.name === 'DB ID');
			if (!userIdField) {
				await interaction.editReply({
					content: 'No DB ID field found in the embed.',
				});
				return;
			}

			globalThis.databaseManager
				.getWarnings(userIdField.value)
				.then(async (warnings) => {
					if (warnings.length === 0) {
						await interaction.editReply({
							content: 'This user has no warnings on record.',
						});
						return;
					}

					const warnEmbeds = warnings.map((warning) => warning.generatePrivateEmbed());
					await interaction.editReply({
						content: `This user has ${warnings.length} warning(s) on record:`,
						embeds: warnEmbeds,
					});
				})
				.catch(async (error) => {
					logger.error(error);
					await interaction.editReply({
						content: 'Failed to retrieve user warnings.',
					});
				});
		}
	},
};
