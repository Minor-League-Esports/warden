const log4js = require('log4js');
const logger = log4js.getLogger('caseHistoryPager');
const { logLevel } = require('../../../config.json');
logger.level = logLevel;

const { generateCaseHistoryPageButtons } = require('../../../util/builders/ButtonFunctions');
const { sortByIdDescending } = require('../../../util/message/HistoryMessageFunctions');

const TYPE_LABELS = { reports: 'report', warnings: 'warning', punishments: 'punishment' };

function getItems(type, kase) {
	if (type === 'reports') return sortByIdDescending(type, kase.getReports());
	if (type === 'warnings') return sortByIdDescending(type, kase.getWarnings());

	// Punishments tied to a warning are nested under it rather than in the case's own list
	const byId = new Map();
	for (const p of [...kase.getPunishments(), ...kase.getWarnings().flatMap((w) => w.getPunishments())]) {
		byId.set(p.getPunishmentId(), p);
	}
	return sortByIdDescending(type, [...byId.values()]);
}

async function buildEmbed(type, item, kase) {
	if (type === 'reports') return item.generatePrivateEmbed();
	return item.generatePrivateEmbed(kase.getReporterNames());
}

/**
 * Renders one page of a case's reports/warnings/punishments.
 * The first click replies to a deferred interaction; page buttons update their own message.
 */
async function showCasePage(interaction, type, caseId, index, isPageButton) {
	const respond = (payload) => (isPageButton ? interaction.update(payload) : interaction.editReply(payload));

	try {
		const kase = await globalThis.databaseManager.getCaseById(caseId);
		const items = getItems(type, kase);
		const label = TYPE_LABELS[type];
		if (items.length === 0) {
			await respond({ content: `Case #${caseId} has no ${type}.`, embeds: [], components: [] });
			return;
		}

		const page = Math.max(0, Math.min(index, items.length - 1));
		await respond({
			content: `Case #${caseId} ${label} ${page + 1} of ${items.length}.`,
			embeds: [await buildEmbed(type, items[page], kase)],
			components: generateCaseHistoryPageButtons(type, caseId, page, items.length),
		});
	} catch (error) {
		logger.error(`Failed to show ${type} for case ${caseId}: ${error}`);
		await respond({ content: `Error: Failed to retrieve ${type} for case #${caseId}.`, embeds: [], components: [] });
	}
}

async function handleCaseHistoryPageButtonClick(interaction) {
	const [, type, caseId, indexStr] = interaction.customId.split(':');
	const index = Number.parseInt(indexStr, 10);
	if (!TYPE_LABELS[type] || Number.isNaN(index)) {
		await interaction.update({ content: 'Error: Invalid pagination request.', embeds: [], components: [] });
		return;
	}
	await showCasePage(interaction, type, caseId, index, true);
}

async function handleCaseHistoryCloseButtonClick(interaction) {
	await interaction.deferUpdate();
	await interaction.message.delete();
}

module.exports = {
	showCasePage,
	handleCaseHistoryPageButtonClick,
	handleCaseHistoryCloseButtonClick,
};
