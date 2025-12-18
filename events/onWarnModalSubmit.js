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

			const [, dbId] = interaction.customId.split(':');
			const rulesBroken = interaction.fields.getTextInputValue('rulesBroken');
			const violatingContent = interaction.fields.getTextInputValue('violatingContent');
			const pointsAddedStr = interaction.fields.getTextInputValue('pointsAdded');
			const moderatorNotes = interaction.fields.getTextInputValue('moderatorNotes');

			const pointsAdded = Number.parseInt(pointsAddedStr, 10);
			if (Number.isNaN(pointsAdded) || pointsAdded < 0) {
				await interaction.editReply({
					content: 'Error: Points Added must be a valid non-negative integer.',
					components: [],
				});
				return;
			}

			// Fetch guild member to get join date
			const mainServer = interaction.client.guilds.cache.get(mainGuild);
			let guildMember;
			try {
				guildMember = await mainServer.members.fetch(interaction.user.id);
			} catch (error) {
				logger.error(error);
			}

			globalThis.databaseManager
				.getUserByDiscordId(dbId, 'db')
				.then(async (dbUser) => {
					const currentPoints = calculateCurrentPoints(dbUser.getWarnings());
					const newPointsTotal = currentPoints + pointsAdded;
					const daysSinceJoin = guildMember?.joinedAt
						? Math.floor((Date.now() - guildMember.joinedAt.getTime()) / (1000 * 60 * 60 * 24))
						: null;
					const recommendedAction = calculateRecommendedAction(newPointsTotal, daysSinceJoin);

					const embed = generateWarnConfirmationEmbed(
						dbUser,
						daysSinceJoin !== null && daysSinceJoin < 90,
						rulesBroken,
						violatingContent,
						pointsAdded,
						newPointsTotal,
						moderatorNotes,
						recommendedAction,
					);
					await interaction.editReply({ embeds: [embed], components: generateWarnConfirmationButtons(dbId) });
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
	},
};

function calculateRecommendedAction(totalPoints, daysSinceJoin) {
	if ((daysSinceJoin < 90 && totalPoints >= 3) || totalPoints >= 5) {
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
	probation,
	rulesBroken,
	violatingContent,
	pointsAdded,
	newPointsTotal,
	moderatorNotes,
	recommendedAction,
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
			{ name: 'On Probation', value: probation ? 'Yes' : 'No', inline: true },
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
				value: String(moderatorNotes ?? 'None'),
			},
			{
				name: 'Recommended Action',
				value: String(generateRecommendedActionDescription(recommendedAction)),
			},
		);
}

function generateWarnConfirmationButtons(dbId) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`executeWarnButton:${dbId}`)
		.setLabel('Confirm Recommended Action')
		.setStyle(ButtonStyle.Success);
	const overrideButton = new ButtonBuilder()
		.setCustomId(`overrideWarnButton:${dbId}`)
		.setLabel('Override Action')
		.setStyle(ButtonStyle.Danger);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, overrideButton);
	return [actionRow];
}
