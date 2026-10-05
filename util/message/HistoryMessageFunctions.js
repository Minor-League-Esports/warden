const { generateUserHistoryEmbed } = require('../builders/EmbedFunctions');
const { generateUserHistoryButtons } = require('../builders/ButtonFunctions');

const HISTORY_TYPES = ['cases', 'reports', 'warnings', 'punishments'];

const ID_GETTERS = {
	cases: (item) => item.getCaseId(),
	reports: (item) => item.getReportId(),
	warnings: (item) => item.getWarningId(),
	punishments: (item) => item.getPunishmentId(),
};

// Newest (highest ID) first
function sortByIdDescending(type, items) {
	const getId = ID_GETTERS[type];
	return [...items].sort((a, b) => Number(getId(b)) - Number(getId(a)));
}

async function loadUserHistory(type, dbId) {
	const db = globalThis.databaseManager;
	let items;
	if (type === 'cases') items = await db.getCasesBySubjectId(dbId);
	else if (type === 'reports') items = await db.getReportsByUserId(dbId, 'subject');
	else if (type === 'warnings') items = await db.getWarnings(dbId);
	else items = await db.getPunishmentsBySubjectId(dbId);
	return sortByIdDescending(type, items);
}

/**
 * Builds the history summary card with a button per category.
 *
 * @param {User} user
 * @returns {Promise<{embeds: EmbedBuilder[], components: ActionRowBuilder[]}>}
 */
async function buildUserHistoryCard(user) {
	const dbId = user.getUserId();
	const [cases, reports, warnings, punishments] = await Promise.all(
		HISTORY_TYPES.map((type) => loadUserHistory(type, dbId)),
	);
	user.setCases(cases);
	user.setWarnings(warnings);

	return {
		embeds: [generateUserHistoryEmbed(user, reports, punishments)],
		components: generateUserHistoryButtons(dbId),
	};
}

module.exports = {
	HISTORY_TYPES,
	sortByIdDescending,
	loadUserHistory,
	buildUserHistoryCard,
};
