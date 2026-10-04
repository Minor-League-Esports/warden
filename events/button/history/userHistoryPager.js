const log4js = require('log4js');
const logger = log4js.getLogger('userHistoryPager');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { generateUserHistoryPageButtons } = require('../../../util/builders/ButtonFunctions');
const { generateWarningHistoryEmbed } = require('../../../util/builders/EmbedFunctions');
const { HISTORY_TYPES, loadUserHistory } = require('../../../util/message/HistoryMessageFunctions');

const TYPE_LABELS = { cases: 'case', reports: 'report', warnings: 'warning', punishments: 'punishment' };

async function buildEmbed(type, item) {
	if (type === 'cases' || type === 'reports') return item.generatePrivateEmbed();
	if (type === 'warnings') return generateWarningHistoryEmbed(item);
	return item.generatePrivateEmbed(item.getCase()?.getReporterNames() ?? 'None');
}

/**
 * Renders one page of a user's cases/reports/warnings/punishments.
 * The first click replies to a deferred interaction; page buttons update their own message.
 */
async function showUserHistoryPage(interaction, type, dbId, index, isPageButton) {
	const respond = (payload) => (isPageButton ? interaction.update(payload) : interaction.editReply(payload));

	try {
		const items = await loadUserHistory(type, dbId);
		if (items.length === 0) {
			await respond({ content: `This user has no ${type} on record.`, embeds: [], components: [] });
			return;
		}

		const page = Math.max(0, Math.min(index, items.length - 1));
		await respond({
			content: `Showing ${TYPE_LABELS[type]} ${page + 1} of ${items.length}.`,
			embeds: [await buildEmbed(type, items[page])],
			components: generateUserHistoryPageButtons(type, dbId, page, items.length),
		});
	} catch (error) {
		logger.error(`Failed to show ${type} for user ${dbId}: ${error}`);
		await respond({ content: `Error: Failed to retrieve ${type}.`, embeds: [], components: [] });
	}
}

async function handleUserHistoryViewButtonClick(interaction) {
	const [, type, dbId] = interaction.customId.split(':');
	if (!HISTORY_TYPES.includes(type)) {
		await interaction.reply({ content: 'Error: Invalid history type.', flags: MessageFlags.Ephemeral });
		return;
	}
	await interaction.deferReply();
	await showUserHistoryPage(interaction, type, dbId, 0, false);
}

async function handleUserHistoryPageButtonClick(interaction) {
	const [, type, dbId, indexStr] = interaction.customId.split(':');
	const index = Number.parseInt(indexStr, 10);
	if (!HISTORY_TYPES.includes(type) || Number.isNaN(index)) {
		await interaction.update({ content: 'Error: Invalid pagination request.', embeds: [], components: [] });
		return;
	}
	await showUserHistoryPage(interaction, type, dbId, index, true);
}

module.exports = {
	handleUserHistoryViewButtonClick,
	handleUserHistoryPageButtonClick,
};
