const log4js = require('log4js');
const logger = log4js.getLogger('onCaseButtonClick');
const { logLevel, moderatorRoleId } = require('../../config.json');
logger.level = logLevel;

const { Events, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const {
	notifyCaseThread,
	refreshReportMessage,
	acknowledgeReport,
	buildWarnUserModal,
	buildModeratorNoteModal,
	appendModeratorNote,
} = require('../../util/UtilFunctions');
const { generateCaseButtons, generateCloseCaseConfirmationButtons } = require('../../util/builders/ButtonFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isButton()) {
			const buttonId = interaction.customId;

			if (buttonId.startsWith('caseCreateWarningButton:')) {
				const [, caseId] = buttonId.split(':');

				try {
					const kase = await globalThis.databaseManager.getCaseById(caseId);
					const modal = buildWarnUserModal(`warnUserModal:${kase.getSubjectId()}:${caseId}`);
					await interaction.showModal(modal);
				} catch (error) {
					logger.error(`Error opening warn modal for case ${caseId}: ${error}`);
					await interaction.reply({
						content: 'Error: Failed to open the warning form for this case.',
						flags: MessageFlags.Ephemeral,
					});
				}
				return;
			}

			if (buttonId.startsWith('caseAddNoteButton:')) {
				const [, caseId] = buttonId.split(':');
				try {
					await globalThis.databaseManager.getCaseById(caseId);
					await interaction.showModal(buildModeratorNoteModal(`addModeratorNoteModal:case:${caseId}`));
				} catch (error) {
					logger.error(`Error opening note modal for case ${caseId}: ${error}`);
					await interaction.reply({ content: `Could not find Case #${caseId}.`, flags: MessageFlags.Ephemeral });
				}
				return;
			}

			if (buttonId.startsWith('confirmCloseCaseButton:')) {
				const [, caseId, userId, sourceMessageId] = buttonId.split(':');
				if (interaction.user.id !== userId) {
					await interaction.reply({
						content: 'Only the moderator who started this confirmation can use it.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				await interaction.update({ content: `Closing Case #${caseId}...`, components: [] });
				await closeCase(interaction, caseId, sourceMessageId);
				return;
			}

			if (buttonId.startsWith('cancelCloseCaseButton:')) {
				const [, caseId, userId] = buttonId.split(':');
				if (interaction.user.id !== userId) {
					await interaction.reply({
						content: 'Only the moderator who started this confirmation can use it.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				await interaction.update({ content: `Closing Case #${caseId} canceled.`, components: [] });
				return;
			}

			if (buttonId.startsWith('closeCaseButton:')) {
				const [, caseId] = buttonId.split(':');
				await interaction.reply({
					content: `Are you sure you want to close Case #${caseId}? This will close all open reports attached to it.`,
					flags: MessageFlags.Ephemeral,
					components: generateCloseCaseConfirmationButtons(caseId, interaction.user.id, interaction.message.id),
				});
				return;
			}
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('addModeratorNoteModal:')) {
			const [, targetType, targetId] = interaction.customId.split(':');
			await interaction.deferReply();

			try {
				const moderator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
				const note = interaction.fields.getTextInputValue('note').trim();
				const target = await appendModeratorNote(targetType, targetId, moderator.getUserName(), note);

				if (targetType === 'case' && target.getCaseLink() && globalThis.caseChannel) {
					const message = await globalThis.caseChannel.messages.fetch(target.getCaseLink().split('/').pop());
					await message.edit({ embeds: [target.generatePrivateEmbed()] });
				} else if (targetType === 'report' && target.getReportLink() && globalThis.reportChannel) {
					const caseLink = target.getCaseId()
						? await globalThis.databaseManager.getCaseById(target.getCaseId()).then((kase) => kase.getCaseLink())
						: null;
					const message = await globalThis.reportChannel.messages.fetch(target.getReportLink().split('/').pop());
					await message.edit({ embeds: [await target.generatePrivateEmbed(caseLink)] });
				}

				await interaction.editReply({
					content: `${moderator.getUserName()} added a note to ${targetType === 'case' ? 'Case' : 'Report'} #${targetId}.`,
				});
			} catch (error) {
				logger.error(`Error adding note to ${targetType} ${targetId}: ${error}`);
				await interaction.editReply({ content: 'Unable to save that moderator note.' });
			}
			return;
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('attachReportToCaseModal:')) {
			const [, reportId] = interaction.customId.split(':');
			const caseIdInput = interaction.fields.getTextInputValue('caseId').trim();
			const caseId = Number.parseInt(caseIdInput, 10);

			if (Number.isNaN(caseId)) {
				await interaction.reply({
					content: 'Error: Case ID must be a valid number.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await interaction.deferReply();

			try {
				// Confirm both records exist and belong to the same subject before attaching.
				const targetCase = await globalThis.databaseManager.getCaseById(caseId);
				const report = await globalThis.databaseManager.getReportById(reportId);
				if (!report) throw new Error(`Report #${reportId} not found`);
				if (report.getSubjectId() !== targetCase.getSubjectId()) {
					await interaction.editReply({
						content: `Report #${reportId} and Case #${caseId} have different subjects and cannot be linked.`,
					});
					return;
				}
				await globalThis.databaseManager.attachReportToCase(reportId, caseId);

				await notifyCaseThread(
					interaction.client,
					caseId,
					`Report #${reportId} attached: ${report?.getReportLink() ?? 'N/A'}`,
				);

				// Acknowledging the report is implied by assigning it to a case
				const updatedReport = await acknowledgeReport(interaction.client, reportId);
				await refreshReportMessage(updatedReport, targetCase.getCaseLink());

				if (interaction.isFromMessage()) {
					await interaction.message.edit({ components: [] });
				}

				await interaction.editReply({ content: `Attached Report #${reportId} to Case #${caseId}.` });
			} catch (error) {
				logger.error(`Error attaching report ${reportId} to case ${caseId}: ${error}`);
				await interaction.editReply({ content: `Error: Could not find or attach to Case #${caseId}.` });
			}
		}
	},
};

async function closeCase(interaction, caseId, sourceMessageId = null) {
	try {
		const { reports: closedReports } = await globalThis.databaseManager.closeCase(caseId);
		const updatedCase = await globalThis.databaseManager.getCaseById(caseId);

		if (sourceMessageId) {
			const sourceMessage = await interaction.channel.messages.fetch(sourceMessageId);
			await sourceMessage.edit({
				components: generateCaseButtons(caseId, { claimed: !!updatedCase.getModerator(), closed: true }),
			});
		}
		await refreshCaseSummary(updatedCase);
		await notifyCaseThread(interaction.client, caseId, `Case #${caseId} has been closed by <@${interaction.user.id}>.`);
		await Promise.all(
			closedReports.map((report) => notifyReporterOfClosedCase(interaction.client, report, updatedCase.getCaseLink())),
		);
		await Promise.all([
			archiveThread(interaction.client, updatedCase.getCaseLink(), `case ${caseId}`),
			...updatedCase
				.getReports()
				.map((report) => archiveThread(interaction.client, report.getReportLink(), `report ${report.getReportId()}`)),
		]);

		await interaction.followUp({ content: `Case #${caseId} has been closed.` });
	} catch (error) {
		logger.error(`Error closing case ${caseId}: ${error}`);
		await interaction.followUp({ content: 'Error: Failed to close case.' });
	}
}

async function refreshCaseSummary(kase) {
	if (!kase.getCaseLink()) return;
	const messageId = kase.getCaseLink().split('/').pop();
	const caseMessage = await globalThis.caseChannel.messages.fetch(messageId);
	await caseMessage.edit({ embeds: [kase.generatePrivateEmbed()], components: [] });
}

async function notifyReporterOfClosedCase(client, report, caseLink) {
	try {
		await refreshReportMessage(report, caseLink);
		const reporter = await globalThis.databaseManager.getUserByIdentifier(report.getReporterId(), 'db');
		if (!reporter) throw new Error('Reporter not found');
		const discordUser = await client.users.fetch(reporter.getDiscordId());
		const reportEmbed = await report.generateUserEmbed();
		await discordUser.send({
			content: `MLE Moderation has reviewed your report #${report.getReportId()} and concluded its investigation. Thank you for helping us maintain a safe community.`,
			embeds: [reportEmbed],
		});
	} catch (error) {
		logger.warn(`Could not notify reporter for closed report ${report.getReportId()}: ${error}`);
	}
}

async function archiveThread(client, parentMessageLink, description) {
	if (!parentMessageLink) return;
	try {
		const thread = await client.channels.fetch(parentMessageLink.split('/').pop());
		if (thread?.setArchived) await thread.setArchived(true);
	} catch (error) {
		logger.warn(`Failed to archive thread for ${description}: ${error}`);
	}
}
