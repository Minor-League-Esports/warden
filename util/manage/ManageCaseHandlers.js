const log4js = require('log4js');
const logger = log4js.getLogger('ManageCase');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { MessageFlags } = require('discord.js');
const { assignCase, createCaseMessage, refreshCaseMessage } = require('../message/CaseMessageFunctions');
const { attachReportToCaseThread } = require('../message/ReportMessageFunctions');
const { buildCaseAddNoteModal } = require('../builders/ModalFunctions');
const { generateCaseDetailsButtons, generateCloseCaseConfirmationButtons } = require('../builders/ButtonFunctions');
const { filterByStatus, finishList } = require('./ManageUtil');

const RECORDS = {
	report: {
		label: 'Report',
		get: (id) => globalThis.databaseManager.getReportById(id),
		update: (id, fields) => globalThis.databaseManager.updateReport(id, fields),
	},
	warning: {
		label: 'Warning',
		get: (id) => globalThis.databaseManager.getWarningById(id),
		update: (id, fields) => globalThis.databaseManager.updateWarning(id, fields),
	},
	punishment: {
		label: 'Punishment',
		get: (id) => globalThis.databaseManager.getPunishmentById(id),
		update: (id, fields) => globalThis.databaseManager.updatePunishment(id, fields),
	},
};

async function fetchCase(interaction, caseId) {
	try {
		return await globalThis.databaseManager.getCaseById(caseId);
	} catch (error) {
		logger.warn(`Error fetching case #${caseId}: ${error}`);
		await interaction.editReply({ content: `Could not find Case #${caseId}.` });
		return null;
	}
}

// Entities report 'N/A' when they have no case
function linkedCaseId(record) {
	const id = record.getCaseId();
	return id == null || id === 'N/A' ? null : id;
}

async function refreshCases(caseIds) {
	for (const caseId of new Set(caseIds.filter((id) => id != null))) {
		try {
			await refreshCaseMessage(await globalThis.databaseManager.getCaseById(caseId));
		} catch (error) {
			logger.warn(`Failed to refresh messages for case #${caseId}: ${error}`);
		}
	}
}

async function attachRecordToCase(interaction, type, id, caseId) {
	const config = RECORDS[type];
	const record = await config.get(id);
	if (!record) {
		await interaction.editReply({ content: `Could not find ${config.label} #${id}.` });
		return;
	}

	const kase = await fetchCase(interaction, caseId);
	if (!kase) return;

	if (kase.isClosed()) {
		await interaction.editReply({ content: `Case #${caseId} is closed.` });
		return;
	}
	if (String(record.getSubjectId()) !== String(kase.getSubjectId())) {
		await interaction.editReply({
			content: `${config.label} #${id} is about a different user than Case #${caseId}.`,
		});
		return;
	}

	const previousCaseId = linkedCaseId(record);
	if (String(previousCaseId) === String(caseId)) {
		await interaction.editReply({ content: `${config.label} #${id} is already attached to Case #${caseId}.` });
		return;
	}

	await config.update(id, { case_id: caseId });

	let threadNote = '';
	if (type === 'report') {
		try {
			await attachReportToCaseThread(record, kase);
		} catch (error) {
			logger.warn(`Could not post report #${id} to case #${caseId} thread: ${error}`);
			threadNote = ' The report could not be posted to the case thread.';
		}
	}
	await refreshCases([caseId, previousCaseId]);

	const moved = previousCaseId ? ` (moved from Case #${previousCaseId})` : '';
	await interaction.editReply({
		content: `Attached ${config.label} #${id} to Case #${caseId}${moved}.${threadNote}`,
	});
}

async function detachRecordFromCase(interaction, type, id) {
	const config = RECORDS[type];
	const record = await config.get(id);
	if (!record) {
		await interaction.editReply({ content: `Could not find ${config.label} #${id}.` });
		return;
	}

	const previousCaseId = linkedCaseId(record);
	if (!previousCaseId) {
		await interaction.editReply({ content: `${config.label} #${id} is not attached to a case.` });
		return;
	}

	await config.update(id, { case_id: null });
	await refreshCases([previousCaseId]);
	await interaction.editReply({ content: `Detached ${config.label} #${id} from Case #${previousCaseId}.` });
}

async function create(interaction) {
	const creator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
	const subject = await globalThis.userUtility.fetchDatabaseUser(interaction.options.getString('user'));
	const newCase = await globalThis.databaseManager.createCase(creator.getUserId(), subject.getUserId());
	await createCaseMessage(newCase);
	const updatedCase = await globalThis.databaseManager.getCaseById(newCase.getCaseId());
	await interaction.editReply({
		content: `Created Case [#${updatedCase.getCaseId()}](${updatedCase.getCaseLink()}).`,
	});
}

async function details(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const kase = await fetchCase(interaction, caseId);
	if (!kase) return;

	const reports = kase.getReports();
	const warnings = kase.getWarnings();
	const punishments = new Map();
	for (const p of [...kase.getPunishments(), ...warnings.flatMap((w) => w.getPunishments())]) {
		punishments.set(p.getPunishmentId(), p);
	}

	const overview = kase.generatePrivateEmbed();
	overview.addFields(
		{ name: 'Reports', value: String(reports.length), inline: true },
		{ name: 'Warnings', value: String(warnings.length), inline: true },
		{ name: 'Punishments', value: String(punishments.size), inline: true },
	);
	await interaction.editReply({
		content: `Details for Case #${caseId}`,
		embeds: [overview],
		components: generateCaseDetailsButtons(caseId),
	});
}

async function list(interaction) {
	const statusFilter = interaction.options.getString('status') ?? 'open';
	const cases = filterByStatus(await globalThis.databaseManager.getAllCases(), statusFilter);
	cases.sort((a, b) => b.getCaseId() - a.getCaseId());

	if (cases.length === 0) {
		await interaction.editReply({
			content:
				statusFilter === 'all' ? 'There have not been any cases submitted yet.' : `There are no ${statusFilter} cases.`,
		});
		return;
	}

	let text = statusFilter === 'all' ? 'All submitted cases:\n' : `All ${statusFilter} cases:\n`;
	for (const kase of cases) {
		const subjectName = kase.getSubjectUser()?.getUserName() ?? 'Unknown';
		text += `- [Case #${kase.getCaseId()}](${kase.getCaseLink()}) - ${subjectName} - ${kase.getStatus()}\n`;
	}
	await interaction.editReply({
		content: finishList(text, 'Use `/manage case details` with an ID to view more details about a specific case.'),
	});
}

async function assign(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const moderatorInput = interaction.options.getString('moderator');

	const kase = await fetchCase(interaction, caseId);
	if (!kase) return;

	let moderator;
	try {
		moderator = await globalThis.userUtility.fetchDatabaseUser(moderatorInput);
	} catch (error) {
		logger.warn(`Error fetching moderator: ${error}`);
		await interaction.editReply({ content: `Could not find moderator '${moderatorInput}'.` });
		return;
	}

	try {
		await assignCase(kase, moderator);
		await interaction.editReply({
			content: `Assigned Case #${caseId} to <@${moderator.getDiscordId()}>. All attached reports were reassigned as well.`,
		});
	} catch (error) {
		await interaction.editReply({
			content: `Failed to assign Case #${caseId} to <@${moderator.getDiscordId()}>.`,
		});
	}
}

async function close(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	const kase = await fetchCase(interaction, caseId);
	if (!kase) return;

	if (String(kase.getStatus()).toUpperCase() === 'CLOSED') {
		await interaction.editReply({ content: `Case #${caseId} is already closed.` });
		return;
	}

	await interaction.editReply({
		content: `Are you sure you want to close Case #${caseId}? This will close all open reports attached to it.`,
		components: generateCloseCaseConfirmationButtons(caseId, interaction.user.id),
	});
}

// Not deferred: showModal must be the first response
async function note(interaction) {
	const caseId = interaction.options.getInteger('case_id');
	try {
		await globalThis.databaseManager.getCaseById(caseId);
	} catch (error) {
		await interaction.reply({ content: `Could not find case #${caseId}.`, flags: MessageFlags.Ephemeral });
		return;
	}
	await interaction.showModal(buildCaseAddNoteModal(caseId));
}

async function attach(interaction) {
	await attachRecordToCase(
		interaction,
		interaction.options.getString('type'),
		interaction.options.getInteger('id'),
		interaction.options.getInteger('case_id'),
	);
}

async function detach(interaction) {
	await detachRecordFromCase(interaction, interaction.options.getString('type'), interaction.options.getInteger('id'));
}

module.exports = {
	handlers: { create, details, list, assign, close, note, attach, detach },
	attachRecordToCase,
	detachRecordFromCase,
};
