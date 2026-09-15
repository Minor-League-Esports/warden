const log4js = require('log4js');
const logger = log4js.getLogger('onWarnModalSubmit');
const { logLevel, mainGuild } = require('../config.json');
logger.level = logLevel;

const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { calculateCurrentPoints } = require('../util/UtilFunctions');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isModalSubmit()) return;

		if (interaction.customId.startsWith('warnUserModal:')) {
			await interaction.deferReply();

			const [, dbId, caseId] = interaction.customId.split(':');
			const rulesBroken = interaction.fields.getTextInputValue('rulesBroken');
			const violatingContent = interaction.fields.getTextInputValue('violatingContent');
			const pointsAddedStr = interaction.fields.getTextInputValue('pointsAdded');
			const moderatorNotes = interaction.fields.getTextInputValue('moderatorNotes');

			const pointsAdded = Number.parseInt(pointsAddedStr, 10);
			if (Number.isNaN(pointsAdded) || pointsAdded < 0) {
				await interaction.editReply({
					content: 'Error: Points Added must be a valid non-negative integer.',
				});
				return;
			}

			const moderator = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);

			globalThis.databaseManager
				.getUserByIdentifier(dbId, 'db')
				.then(async (dbUser) => {
					dbUser.setWarnings(await globalThis.databaseManager.getWarnings(dbUser.getUserId()));

					// Fetch guild member to get join date
					const mainServer = interaction.client.guilds.cache.get(mainGuild);
					let guildMember;
					try {
						guildMember = await mainServer.members.fetch(dbUser.getDiscordId());
					} catch (error) {
						logger.error(error);
					}
					const currentPoints = calculateCurrentPoints(dbUser.getWarnings());
					const newPointsTotal = currentPoints + pointsAdded;
					const daysSinceJoin = guildMember?.joinedAt
						? Math.floor((Date.now() - guildMember.joinedAt.getTime()) / (1000 * 60 * 60 * 24))
						: null;
					const onProbation = daysSinceJoin !== null && daysSinceJoin < 90;
					const probationStatus = daysSinceJoin !== null ? onProbation : 'Unknown';
					logger.debug('Joined at:', guildMember?.joinedAt);
					logger.debug(`Days since join: ${daysSinceJoin}, On probation: ${onProbation}`);
					const recommendedAction = calculateRecommendedAction(newPointsTotal, onProbation);

					const embed = generateWarnConfirmationEmbed(
						dbUser,
						probationStatus,
						rulesBroken,
						violatingContent,
						pointsAdded,
						newPointsTotal,
						moderatorNotes,
						recommendedAction,
						caseId,
					);
					await interaction.editReply({
						embeds: [embed],
						components: generateWarnConfirmationButtons(dbId, moderator.getUserId(), recommendedAction, caseId),
					});
				})
				.catch(async (error) => {
					logger.error(error);
					await interaction.editReply({
						content: 'Error: Failed to retrieve user warnings.',
						components: [],
					});
				});

			return;
		}

		if (interaction.customId.startsWith('overrideWarnModal:')) {
			const [, dbId, moderatorId, caseId] = interaction.customId.split(':');
			const action = parseOverrideAction(interaction.fields.getTextInputValue('punishments'));
			if (!action) {
				await interaction.reply({
					content: 'Use one or more actions separated by `;`: `mute=<days>`, `suspension=<weeks>`, or `ban`.',
				});
				return;
			}

			const proposalEmbed = interaction.message?.embeds[0];
			if (!proposalEmbed) {
				await interaction.reply({ content: 'Error: The original warning proposal could not be found.' });
				return;
			}

			const fields = proposalEmbed.fields.map((field) =>
				field.name === 'Recommended Action' ? { ...field, value: describeAction(action) } : field,
			);
			const overrideEmbed = EmbedBuilder.from(proposalEmbed).setFields(fields);
			await interaction.update({
				embeds: [overrideEmbed],
				components: generateWarnConfirmationButtons(dbId, moderatorId, action, caseId),
			});
			return;
		}
	},
};

function calculateRecommendedAction(totalPoints, onProbation) {
	if ((onProbation && totalPoints >= 3) || totalPoints >= 5) {
		return 'ban';
	} else if (totalPoints == 4) {
		return 'mute=28;suspension=4';
	} else if (totalPoints == 3) {
		return 'mute=28;suspension=1';
	} else if (totalPoints == 2) {
		return 'mute=14';
	} else if (totalPoints == 1) {
		return 'mute=7';
	} else {
		return 'warning';
	}
}

function generateRecommendedActionDescription(action) {
	if (action === 'ban') {
		return 'Ban the user';
	} else if (action.startsWith('mute=') && action.includes(';suspension=')) {
		const [mutePart, suspensionPart] = action.split(';');
		const muteDays = mutePart.split('=')[1];
		const suspensionWeeks = suspensionPart.split('=')[1];
		return `Mute for ${muteDays} days and suspend for ${suspensionWeeks} week(s)`;
	} else if (action.startsWith('mute=')) {
		const muteDays = action.split('=')[1];
		return `Mute for ${muteDays} days`;
	} else if (action === 'warning') {
		return 'Issue a warning';
	} else {
		return 'No action recommended';
	}
}

function generateWarnConfirmationEmbed(
	dbUser,
	probationStatus,
	rulesBroken,
	violatingContent,
	pointsAdded,
	newPointsTotal,
	moderatorNotes,
	recommendedAction,
	caseId,
) {
	return new EmbedBuilder()
		.setColor('#ff761b')
		.setTitle(`${dbUser.getUserName()} | Warning Proposed`)
		.setFooter({ text: `ID: ${dbUser.getDiscordId()}` })
		.setTimestamp()
		.setThumbnail(dbUser.getDiscordAvatar())
		.addFields(
			{ name: 'User', value: `<@${dbUser.getDiscordId()}>`, inline: true },
			{ name: 'MLE ID', value: dbUser.getMleId() ?? 'N/A', inline: true },
			{ name: 'On Probation', value: String(probationStatus), inline: true },
			{ name: 'Rule(s) Broken', value: String(rulesBroken ?? 'None') },
			{ name: 'Violating Content', value: String(violatingContent ?? 'None') },
			{
				name: 'Points Added',
				value: String(pointsAdded === 1 ? '1 point' : `${pointsAdded} points`),
				inline: true,
			},
			{
				name: 'New Points Total',
				value: String(newPointsTotal === 1 ? '1 point' : `${newPointsTotal} points`),
				inline: true,
			},
			{
				name: 'Moderator Notes',
				value: String(moderatorNotes?.trim() === '' ? 'None' : moderatorNotes.trim()),
			},
			{
				name: 'Recommended Action',
				value: String(generateRecommendedActionDescription(recommendedAction)),
			},
			{ name: 'Case', value: caseId ? `#${caseId}` : 'None', inline: true },
		);
}

function generateWarnConfirmationButtons(dbId, moderatorId, recommendedAction, caseId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`executeWarnButton:${dbId}:${moderatorId}:${recommendedAction}:${caseId ?? ''}`)
		.setLabel('Confirm Recommended Action')
		.setStyle(ButtonStyle.Success);
	const overrideButton = new ButtonBuilder()
		.setCustomId(`overrideWarnButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Override Action')
		.setStyle(ButtonStyle.Danger);
	const cancelButton = new ButtonBuilder()
		.setCustomId(`cancelWarnButton:${dbId}:${moderatorId}:${caseId ?? ''}`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, overrideButton, cancelButton);
	return [actionRow];
}

function parseOverrideAction(input) {
	const actions = input
		.split(';')
		.map((action) => action.trim().toLowerCase())
		.filter(Boolean);
	if (actions.length === 0 || new Set(actions).size !== actions.length) return null;

	for (const action of actions) {
		if (action === 'warning' || action === 'ban') continue;
		if (!/^(mute|suspension)=[1-9]\d*$/.test(action)) return null;
	}
	return actions.join(';');
}

function describeAction(action) {
	return action
		.split(';')
		.map((entry) => {
			if (entry === 'warning') return 'Issue an official warning';
			if (entry === 'ban') return 'Ban the user';
			const [type, duration] = entry.split('=');
			return type === 'mute' ? `Mute for ${duration} day(s)` : `Suspend for ${duration} week(s)`;
		})
		.join('\n');
}
