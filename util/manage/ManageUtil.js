/**
 * Keeps only objects matching the 'open' / 'closed' / 'all' status filter.
 *
 * @param {Array<{getStatus: Function}>} objects
 * @param {String} status
 */
function filterByStatus(objects, status) {
	if (status === 'open') return objects.filter((obj) => obj.getStatus().toLowerCase() !== 'closed');
	if (status === 'closed') return objects.filter((obj) => obj.getStatus().toLowerCase() === 'closed');
	return objects;
}

// Discord caps message content at 2000 characters
function finishList(text, hint) {
	const body = text.length > 1800 ? text.slice(0, 1780) + '\n... (truncated)' : text;
	return `${body}\n${hint}`;
}

function discordDate(timestamp) {
	return `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:d>`;
}

// Replies and returns null when no user matches the identifier
async function fetchUserOrReply(interaction, identifier) {
	try {
		return await globalThis.userUtility.fetchDatabaseUser(identifier);
	} catch (error) {
		await interaction.editReply({ content: `Could not find user '${identifier}'.` });
		return null;
	}
}

module.exports = {
	fetchUserOrReply,
	filterByStatus,
	finishList,
	discordDate,
};
