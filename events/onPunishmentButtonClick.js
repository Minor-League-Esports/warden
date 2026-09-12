const log4js = require('log4js');
const logger = log4js.getLogger('onPunishmentButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('cancel')) {
			await interaction.update({
				content: 'Action cancelled.',
				components: [],
			});
			return;
		}

		if (buttonId.includes('ConfirmButton:')) {
			await interaction.deferReply();
			const [, dbId] = buttonId.split(':');
			const punishmentType = buttonId.split('ConfirmButton:')[0].toLowerCase();
			const embed = interaction.message.embeds[0];
			const durationField = embed.fields.find((field) => field.name === 'Duration');
			const durationStr = durationField ? durationField.value.split(' ')[0] : null;
			const moderator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
			logger.debug(`Processing punishment of type ${punishmentType} for user DB ID: ${dbId}`);

			// Create the punishment in the database
			const punishment = await globalThis.databaseManager.createPunishment(
				dbId,
				moderator.getUserId(),
				punishmentType,
				durationStr ? Number.parseInt(durationStr, 10) : null,
			);
			// createPunishment's return value has no joined user data, so hydrate it manually for embed rendering
			punishment.setSubject(await globalThis.databaseManager.getUserByIdentifier(dbId, 'db'));
			punishment.setModerator(moderator);

			// Execute the punishment
			globalThis.punishmentExecutor
				.executePunishment(punishment)
				.then(async () => {
					logger.info(`Successfully executed ${punishmentType} for user with DB ID: ${dbId}`);
					await interaction.editReply({ content: `Successfully executed ${punishmentType}.` });
				})
				.catch((error) => {
					logger.error(`Error executing ${punishmentType} for user with DB ID: ${dbId}: ${error}`);
					interaction.editReply({ content: `Error executing ${punishmentType}.` });
				});
		}
	},
};
