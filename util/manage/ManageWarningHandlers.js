const { MessageFlags } = require('discord.js');
const { buildWarningAddNoteModal } = require('../builders/ModalFunctions');
const { generateWarningHistoryEmbed } = require('../builders/EmbedFunctions');
const { sortByIdDescending } = require('../message/HistoryMessageFunctions');
const { attachRecordToCase, detachRecordFromCase } = require('./ManageCaseHandlers');
const { discordDate, fetchUserOrReply, finishList } = require('./ManageUtil');

async function details(interaction) {
	const warningId = interaction.options.getInteger('warning_id');
	const warning = await globalThis.databaseManager.getWarningById(warningId);
	if (!warning) {
		await interaction.editReply({ content: `Could not find Warning #${warningId}.` });
		return;
	}

	await interaction.editReply({
		content: `Details for Warning #${warningId}`,
		embeds: [generateWarningHistoryEmbed(warning)],
	});
}

async function list(interaction) {
	const user = await fetchUserOrReply(interaction, interaction.options.getString('user'));
	if (!user) return;

	const warnings = sortByIdDescending('warnings', await globalThis.databaseManager.getWarnings(user.getUserId()));
	if (warnings.length === 0) {
		await interaction.editReply({ content: `${user.getUserName()} has no warnings on record.` });
		return;
	}

	let text = `Warnings for ${user.getUserName()}:\n`;
	for (const warning of warnings) {
		const rules = String(warning.getRulesBroken() ?? 'None').replace(/\s+/g, ' ');
		text += `- Warning #${warning.getWarningId()} - ${discordDate(warning.getTimestamp())} - ${warning.getPointsAdded()} pt(s) - Case ${warning.getCaseId()} - ${rules.slice(0, 60)}\n`;
	}
	await interaction.editReply({
		content: finishList(text, 'Use `/manage warning details` with an ID to view more details about a specific warning.'),
	});
}

// Not deferred: showModal must be the first response
async function note(interaction) {
	const warningId = interaction.options.getInteger('warning_id');
	if (!(await globalThis.databaseManager.getWarningById(warningId))) {
		await interaction.reply({ content: `Could not find warning #${warningId}.`, flags: MessageFlags.Ephemeral });
		return;
	}
	await interaction.showModal(buildWarningAddNoteModal(warningId));
}

async function attach(interaction) {
	await attachRecordToCase(
		interaction,
		'warning',
		interaction.options.getInteger('warning_id'),
		interaction.options.getInteger('case_id'),
	);
}

async function detach(interaction) {
	await detachRecordFromCase(interaction, 'warning', interaction.options.getInteger('warning_id'));
}

module.exports = {
	handlers: { details, list, note, attach, detach },
};
