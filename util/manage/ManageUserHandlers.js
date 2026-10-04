const { buildUserHistoryCard } = require('../message/HistoryMessageFunctions');
const { generateMergeUsersConfirmationButtons } = require('../builders/ButtonFunctions');
const { fetchUserOrReply } = require('./ManageUtil');

async function details(interaction) {
	const user = await fetchUserOrReply(interaction, interaction.options.getString('user'));
	if (!user) return;

	const card = await buildUserHistoryCard(user);
	await interaction.editReply({
		embeds: [user.generateUserInfoEmbed(), ...card.embeds],
		components: card.components,
	});
}

async function setMleId(interaction) {
	const user = await fetchUserOrReply(interaction, interaction.options.getString('user'));
	if (!user) return;

	const mleId = interaction.options.getString('mle_id').trim();
	const existing = await globalThis.databaseManager.getUserByIdentifier(mleId, 'mle');
	if (existing && existing.getUserId() !== user.getUserId()) {
		await interaction.editReply({
			content: `MLE ID ${mleId} already belongs to ${existing.getUserName()}.`,
		});
		return;
	}

	await globalThis.databaseManager.updateUser(user.getUserId(), { mle_id: mleId });
	await interaction.editReply({ content: `Set the MLE ID for ${user.getUserName()} to ${mleId}.` });
}

async function setDiscordId(interaction) {
	const user = await fetchUserOrReply(interaction, interaction.options.getString('user'));
	if (!user) return;

	const discordId = interaction.options.getString('discord_id').trim();
	if (!/^\d{17,20}$/.test(discordId)) {
		await interaction.editReply({ content: `'${discordId}' is not a valid Discord ID.` });
		return;
	}

	const existing = await globalThis.databaseManager.getUserByIdentifier(discordId, 'discord');
	if (existing && existing.getUserId() !== user.getUserId()) {
		await interaction.editReply({
			content: `Discord ID ${discordId} already belongs to ${existing.getUserName()}. Use \`/manage user merge\` to combine the two profiles.`,
		});
		return;
	}

	await globalThis.databaseManager.updateUser(user.getUserId(), { discord_id: discordId });
	await interaction.editReply({ content: `Set the Discord ID for ${user.getUserName()} to ${discordId}.` });
}

async function setUsername(interaction) {
	const user = await fetchUserOrReply(interaction, interaction.options.getString('user'));
	if (!user) return;

	const username = interaction.options.getString('username').trim();
	const existing = await globalThis.databaseManager.getUserByIdentifier(username, 'name');
	if (existing && existing.getUserId() !== user.getUserId()) {
		await interaction.editReply({
			content: `The username ${username} already belongs to another profile. Use \`/manage user merge\` to combine the two profiles.`,
		});
		return;
	}

	const previousName = user.getUserName();
	await globalThis.databaseManager.updateUser(user.getUserId(), { user_name: username });
	await interaction.editReply({ content: `Renamed ${previousName} to ${username}.` });
}

// Destructive, so it only prompts; the confirm button performs the merge
async function merge(interaction) {
	const source = await fetchUserOrReply(interaction, interaction.options.getString('source'));
	if (!source) return;
	const target = await fetchUserOrReply(interaction, interaction.options.getString('target'));
	if (!target) return;

	if (source.getUserId() === target.getUserId()) {
		await interaction.editReply({ content: 'The source and target are the same profile.' });
		return;
	}

	await interaction.editReply({
		content:
			`Merge **${source.getUserName()}** (Discord ID ${source.getDiscordId()}) into **${target.getUserName()}** (Discord ID ${target.getDiscordId()})?\n` +
			`All of ${source.getUserName()}'s cases, reports, warnings, and punishments will move to ${target.getUserName()}, ` +
			`and the ${source.getUserName()} profile will be deleted. This cannot be undone.`,
		components: generateMergeUsersConfirmationButtons(source.getUserId(), target.getUserId(), interaction.user.id),
	});
}

module.exports = {
	handlers: { details, set_mle_id: setMleId, set_discord_id: setDiscordId, set_username: setUsername, merge },
};
