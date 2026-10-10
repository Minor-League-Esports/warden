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
			const caseObj = caseId ? await globalThis.databaseManager.getCaseById(caseId) : null;

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
				caseObj,
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

module.exports = {
	handleWarnUserModalSubmit,
};
