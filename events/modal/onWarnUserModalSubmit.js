const log4js = require('log4js');
const logger = log4js.getLogger('onWarnModalSubmit');
const { logLevel, mainGuild } = require('../../config.json');
logger.level = logLevel;

const { calculateCurrentPoints } = require('../../util/UtilFunctions');
const { generateWarnConfirmationEmbed } = require('../../util/builders/EmbedFunctions');
const { generateWarnConfirmationButtons } = require('../../util/builders/ButtonFunctions');

async function handleWarnUserModalSubmit(interaction) {
	await interaction.deferReply();

	const [, dbId, caseId] = interaction.customId.split(':');
	const rulesBroken = interaction.fields.getTextInputValue('rulesBroken');
	const violatingContent = interaction.fields.getTextInputValue('violatingContent');
	const pointsAddedStr = interaction.fields.getTextInputValue('pointsAdded');
	const moderatorNotes = interaction.fields.getTextInputValue('moderatorNotes');

	const pointsAdded = Number.parseInt(pointsAddedStr, 10);
	if (Number.isNaN(pointsAdded) || pointsAdded < 0) {
		await interaction.editReply({
			content: 'Error: Points Added must be a valid integer greater than or equal to 0.',
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

module.exports = {
	handleWarnUserModalSubmit,
};
