const log4js = require('log4js');
const logger = log4js.getLogger('onButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;
		const buttonMessage = interaction.message;

		// Helper to build pagination components
		const buildPaginationComponents = (dbId, index, total) => {
			const prevDisabled = index <= 0;
			const nextDisabled = index >= total - 1;
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`userHistoryPrev:${dbId}:${index - 1}`)
					.setLabel('Prev')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(prevDisabled),
				new ButtonBuilder()
					.setCustomId(`userHistoryNext:${dbId}:${index + 1}`)
					.setLabel('Next')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(nextDisabled),
				new ButtonBuilder().setCustomId(`userHistoryAll:${dbId}`).setLabel('View All').setStyle(ButtonStyle.Primary),
			);
			return [row];
		};

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
							components: [],
						});
						return;
					}

					// most recent warning
					const indexToShow = 0;
					const embed = warnings[indexToShow].generatePrivateEmbed();
					const components = buildPaginationComponents(userIdField.value, indexToShow, warnings.length);
					await interaction.editReply({
						content: `Showing warning ${indexToShow + 1} of ${warnings.length}.`,
						embeds: [embed],
						components,
					});
				})
				.catch(async (error) => {
					logger.error(error);
					await interaction.editReply({
						content: 'Failed to retrieve user warnings.',
						components: [],
					});
				});
			return;
		}

		// Handle pagination button clicks
		if (buttonId.startsWith('userHistoryPrev:') || buttonId.startsWith('userHistoryNext:')) {
			const [, dbId, targetIndexStr] = buttonId.split(':');
			let targetIndex = Number.parseInt(targetIndexStr, 10);
			if (Number.isNaN(targetIndex)) {
				await interaction.reply({ content: 'Invalid pagination index.', ephemeral: true });
				return;
			}

			try {
				const warnings = await globalThis.databaseManager.getWarnings(dbId);
				if (warnings.length === 0) {
					await interaction.reply({ content: 'This user has no warnings on record.', ephemeral: true });
					return;
				}

				// Clamp index to bounds
				targetIndex = Math.max(0, Math.min(targetIndex, warnings.length - 1));
				const embed = warnings[targetIndex].generatePrivateEmbed();
				const components = buildPaginationComponents(dbId, targetIndex, warnings.length);

				// Update the original message containing the buttons
				await interaction.update({
					content: `Showing warning ${targetIndex + 1} of ${warnings.length}.`,
					embeds: [embed],
					components,
				});
			} catch (error) {
				logger.error(error);
				await interaction.reply({ content: 'Failed to paginate warnings.', ephemeral: true });
			}
		}

		// Handle view-all button click
		if (buttonId.startsWith('userHistoryAll:')) {
			const [, dbId] = buttonId.split(':');
			try {
				const warnings = await globalThis.databaseManager.getWarnings(dbId);
				if (warnings.length === 0) {
					await interaction.reply({ content: 'This user has no warnings on record.', ephemeral: true });
					return;
				}

				const allEmbeds = warnings.map((w) => w.generatePrivateEmbed());
				const chunkSize = 10;
				const chunks = [];
				for (let i = 0; i < allEmbeds.length; i += chunkSize) {
					chunks.push(allEmbeds.slice(i, i + chunkSize));
				}

				// Update original message with the first chunk and remove components
				const firstCount = chunks[0].length;
				await interaction.update({
					content: `Showing all warnings (1-${firstCount} of ${warnings.length}).`,
					embeds: chunks[0],
					components: [],
				});

				// Send follow-up messages for remaining chunks
				for (let c = 1; c < chunks.length; c++) {
					const start = c * chunkSize + 1;
					const end = Math.min((c + 1) * chunkSize, warnings.length);
					// Visible to channel; if you prefer ephemeral, set ephemeral: true
					await interaction.followUp({
						content: `Warnings ${start}-${end} of ${warnings.length}.`,
						embeds: chunks[c],
					});
				}
			} catch (error) {
				logger.error(error);
				await interaction.reply({ content: 'Failed to display all warnings.', ephemeral: true });
			}
		}
	},
};
