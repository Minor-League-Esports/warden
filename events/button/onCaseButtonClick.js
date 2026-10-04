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
		}
	},
};
