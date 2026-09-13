const log4js = require('log4js');
const logger = log4js.getLogger('onUserHistoryButtonClick');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCaseLinkById } = require('../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('userViewHistoryButton:')) {
			await interaction.deferReply();
			const [, dbId] = buttonId.split(':');
			logger.debug(`Fetching warnings for user DB ID: ${dbId}`);

			globalThis.databaseManager
				.getWarnings(dbId)
				.then(async (warnings) => {
					if (warnings.length === 0) {
						await interaction.editReply({
							content: 'This user has no warnings on record.',
							components: buildStandalonePunishmentComponents(dbId),
						});
						return;
					}

					// most recent warning
					const indexToShow = 0;
					const embed = warnings[indexToShow].generatePrivateEmbed(await getCaseLinkById(warnings[indexToShow].getCaseId()));
					const components = buildPaginationComponents(dbId, indexToShow, warnings.length);
					await interaction.editReply({
						content: `Showing warning ${indexToShow + 1} of ${warnings.length}.`,
						embeds: [embed],
						components,
					});
				})
				.catch(async (error) => {
					logger.error(error);
					await interaction.editReply({
						content: 'Error: Failed to retrieve user warnings.',
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
				await interaction.update({ content: 'Error: Invalid pagination index.' });
				return;
			}

			try {
				const warnings = await globalThis.databaseManager.getWarnings(dbId);
				if (warnings.length === 0) {
					await interaction.update({ content: 'This user has no warnings on record.' });
					return;
				}

				// Clamp index to bounds
				targetIndex = Math.max(0, Math.min(targetIndex, warnings.length - 1));
				const embed = warnings[targetIndex].generatePrivateEmbed(await getCaseLinkById(warnings[targetIndex].getCaseId()));
				const components = buildPaginationComponents(dbId, targetIndex, warnings.length);

				// Update the original message containing the buttons
				await interaction.update({
					content: `Showing warning ${targetIndex + 1} of ${warnings.length}.`,
					embeds: [embed],
					components,
				});
			} catch (error) {
				logger.error(error);
				await interaction.update({ content: 'Error: Failed to paginate warnings.' });
			}
		}

		// Handle view-all button click
		if (buttonId.startsWith('userHistoryAll:')) {
			const [, dbId] = buttonId.split(':');
			try {
				const warnings = await globalThis.databaseManager.getWarnings(dbId);
				if (warnings.length === 0) {
					await interaction.update({ content: 'This user has no warnings on record.' });
					return;
				}

				const allEmbeds = await Promise.all(
					warnings.map(async (w) => w.generatePrivateEmbed(await getCaseLinkById(w.getCaseId()))),
				);
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
				await interaction.update({ content: 'Error: Failed to display all warnings.' });
			}
		}

		// Handle view standalone punishments button click
		if (buttonId.startsWith('userHistoryPunAll:')) {
			await interaction.deferReply();
			const [, dbId] = buttonId.split(':');
			try {
				const punishments = await globalThis.databaseManager.getStandalonePunishments(dbId);
				if (punishments.length === 0) {
					await interaction.editReply({ content: 'This user has no standalone punishments on record.' });
					return;
				}

				const allEmbeds = punishments.map((p) => p.generatePrivateEmbed());
				const chunkSize = 10;
				const chunks = [];
				for (let i = 0; i < allEmbeds.length; i += chunkSize) {
					chunks.push(allEmbeds.slice(i, i + chunkSize));
				}

				const firstCount = chunks[0].length;
				await interaction.editReply({
					content: `Showing standalone punishments (1-${firstCount} of ${punishments.length}).`,
					embeds: chunks[0],
					components: [],
				});

				for (let c = 1; c < chunks.length; c++) {
					const start = c * chunkSize + 1;
					const end = Math.min((c + 1) * chunkSize, punishments.length);
					await interaction.followUp({
						content: `Standalone punishments ${start}-${end} of ${punishments.length}.`,
						embeds: chunks[c],
					});
				}
			} catch (error) {
				logger.error(error);
				await interaction.editReply({
					content: 'Error: Failed to display standalone punishments.',
				});
			}
		}
	},
};

// Helper to build pagination components
function buildPaginationComponents(dbId, index, total) {
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
		new ButtonBuilder()
			.setCustomId(`userHistoryPunAll:${dbId}`)
			.setLabel('View Standalone Punishments')
			.setStyle(ButtonStyle.Primary),
	);
	return [row];
}

function buildStandalonePunishmentComponents(dbId) {
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`userHistoryPunAll:${dbId}`)
			.setLabel('View All Standalone Punishments')
			.setStyle(ButtonStyle.Primary),
	);
	return [row];
}
