const log4js = require('log4js');
const logger = log4js.getLogger('onWarnButtonClick');
const { logLevel, directorRoleId } = require('../config.json');
logger.level = logLevel;

const {
	Events,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	LabelBuilder,
	TextInputStyle,
	PermissionFlagsBits,
} = require('discord.js');
const { buildWarnUserModal, notifyCaseThread } = require('../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('userConfirmWarnButton:')) {
			const [, dbId, caseId] = buttonId.split(':');

			const modal = buildWarnUserModal(`warnUserModal:${dbId}:${caseId ?? ''}`);

			await interaction.showModal(modal);
		}

		if (buttonId.startsWith('overrideWarnButton:')) {
			const [, dbId, moderatorId, caseId] = buttonId.split(':');
			const modal = new ModalBuilder()
				.setCustomId(`overrideWarnModal:${dbId}:${moderatorId}:${caseId ?? ''}`)
				.setTitle('Override Suggested Action');
			const punishmentsInput = new TextInputBuilder()
				.setCustomId('punishments')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('mute=7;suspension=1')
				.setRequired(true);
			const punishmentsLabel = new LabelBuilder()
				.setLabel('Punishments, separated by semicolons')
				.setTextInputComponent(punishmentsInput);
			modal.addLabelComponents(punishmentsLabel);
			await interaction.showModal(modal);
			return;
		}

		if (buttonId.startsWith('executeWarnButton:')) {
			const [, dbId, moderatorId, recommendedAction, caseId] = buttonId.split(':');
			logger.debug(`Executing recommended action: ${recommendedAction} for user with DB ID: ${dbId}`);
			const buttonMessage = interaction.message;
			const proposalEmbed = buttonMessage.embeds[0];

			// Remove buttons after click
			await interaction.update({
				components: [],
			});

			if (recommendedAction === 'ban') {
				// Post approval embed
				const approvalEmbed = EmbedBuilder.from(proposalEmbed).setColor('#ff0000');
				await interaction.channel.send({
					embeds: [approvalEmbed],
					components: [generateBanApprovalButtons(dbId, moderatorId, caseId)],
					content: `
                    <@&${directorRoleId}> please review the below ban request. Clicking "Approve Ban" will enact the ban. Ensure League Operations has moved the user to FP.`,
				});
			} else {
				// Get the subject's user record
				const subject = await globalThis.databaseManager.getUserByIdentifier(dbId, 'db');
				// Execute other punishments directly
				globalThis.punishmentExecutor
					.execute(dbId, moderatorId, moderatorId, proposalEmbed, recommendedAction, caseId || null)
					.then(async () => {
						logger.info(`Successfully executed ${recommendedAction} for user with DB ID: ${dbId}`);
						await interaction.followUp({ content: 'Successfully executed punishment.' });
						if (caseId) {
							await notifyCaseThread(
								interaction.client,
								caseId,
								`Warning issued to <@${subject.getDiscordId()}> by <@${interaction.user.id}>: ${recommendedAction}`,
							);
						}
						if (recommendedAction.includes('suspension')) {
							await interaction.followUp({
								content: `Note: Suspensions are not automatically executed by Warden yet. Please handle the suspension manually via League Operations.`,
							});
						}
					})
					.catch((error) => {
						logger.error(`Error executing ${recommendedAction} for user with DB ID: ${dbId}: ${error}`);
						interaction.followUp({ content: `Error executing ${recommendedAction}.` });
					});
			}
		}

		if (buttonId.startsWith('approveBanButton:')) {
			const [, dbId, moderatorId, caseId] = buttonId.split(':');
			const buttonMessage = interaction.message;
			const proposalEmbed = buttonMessage.embeds[0];

			// Check permissions
			if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
				logger.warn(`User ${interaction.user.id} attempted to approve a ban without sufficient permissions.`);
				await interaction.reply({ content: `<@${interaction.user.id}>, you do not have permission to approve bans.` });
				return;
			}

			// Get the director's user record
			const director = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

			// Remove buttons after click
			await interaction.update({
				components: [],
			});

			// Get the subject's user record
			const subject = await globalThis.databaseManager.getUserByIdentifier(dbId, 'db');

			// Execute ban
			globalThis.punishmentExecutor
				.execute(dbId, moderatorId, director.getUserId(), proposalEmbed, 'ban', caseId || null)
				.then(async () => {
					logger.info(`Successfully executed ban for user with DB ID: ${dbId}`);
					await interaction.followUp({ content: 'Successfully executed ban.' });
					if (caseId) {
						await notifyCaseThread(
							interaction.client,
							caseId,
							`Ban approved and executed for <@${subject.getDiscordId()}>.`,
						);
					}
					// TODO: Generate community announcement with confirmation
				})
				.catch((error) => {
					logger.error(`Error executing ban for user with DB ID: ${dbId}: ${error}`);
					interaction.followUp({ content: 'Error executing ban.' });
				});
		}

		if (buttonId.startsWith('denyBanButton:')) {
			const [, dbId, moderatorId] = buttonId.split(':');

			// Check permissions
			if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
				logger.warn(`User ${interaction.user.id} attempted to deny a ban without sufficient permissions.`);
				await interaction.reply({ content: 'You do not have permission to deny bans.' });
				return;
			}

			// Remove buttons after click
			await interaction.update({
				components: [],
			});

			logger.info(`Ban denied for user with DB ID: ${dbId} by moderator ID: ${moderatorId}`);
			await interaction.followUp({ content: 'Ban has been denied.' });
		}
	},
};

function generateBanApprovalButtons(dbId, moderatorId, caseId) {
	const approveButton = new ButtonBuilder()
		.setCustomId(`approveBanButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Approve Ban')
		.setStyle(ButtonStyle.Success);
	const denyButton = new ButtonBuilder()
		.setCustomId(`denyBanButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Deny Ban')
		.setStyle(ButtonStyle.Danger);
	return new ActionRowBuilder().addComponents(approveButton, denyButton);
}
