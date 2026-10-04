const { sortByIdDescending } = require('../message/HistoryMessageFunctions');
const { attachRecordToCase, detachRecordFromCase } = require('./ManageCaseHandlers');
const { discordDate, fetchUserOrReply, finishList } = require('./ManageUtil');

async function details(interaction) {
	const punishmentId = interaction.options.getInteger('punishment_id');
	const punishment = await globalThis.databaseManager.getPunishmentById(punishmentId);
	if (!punishment) {
		await interaction.editReply({ content: `Could not find Punishment #${punishmentId}.` });
		return;
	}

	await interaction.editReply({
		content: `Details for Punishment #${punishmentId}`,
		embeds: [punishment.generatePrivateEmbed(punishment.getCase()?.getReporterNames() ?? 'None')],
	});
}

async function list(interaction) {
	const user = await fetchUserOrReply(interaction, interaction.options.getString('user'));
	if (!user) return;

	const punishments = sortByIdDescending(
		'punishments',
		await globalThis.databaseManager.getPunishmentsBySubjectId(user.getUserId()),
	);
	if (punishments.length === 0) {
		await interaction.editReply({ content: `${user.getUserName()} has no punishments on record.` });
		return;
	}

	let text = `Punishments for ${user.getUserName()}:\n`;
	for (const punishment of punishments) {
		const duration = punishment.getDuration() != null ? ` (${punishment.getDuration()})` : '';
		text += `- Punishment #${punishment.getPunishmentId()} - ${punishment.getType()}${duration} - ${discordDate(punishment.getTimestamp())} - Case ${punishment.getCaseId()}\n`;
	}
	await interaction.editReply({
		content: finishList(
			text,
			'Use `/manage punishment details` with an ID to view more details about a specific punishment.',
		),
	});
}

async function attach(interaction) {
	await attachRecordToCase(
		interaction,
		'punishment',
		interaction.options.getInteger('punishment_id'),
		interaction.options.getInteger('case_id'),
	);
}

async function detach(interaction) {
	await detachRecordFromCase(interaction, 'punishment', interaction.options.getInteger('punishment_id'));
}

module.exports = {
	handlers: { details, list, attach, detach },
};
