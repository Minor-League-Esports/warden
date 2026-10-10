const log4js = require('log4js');
const logger = log4js.getLogger('WarnCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { generateUserSummaryButtons } = require('../util/builders/ButtonFunctions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('warn')
		.setDescription('Warns a user')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option.setName('user').setDescription('The user to warn (name, disc ID, MLE ID)').setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('case_id')
				.setDescription('The ID of the case associated with this warning (-1 for no case)')
				.setMinValue(-1)
				.setRequired(false),
		),
	async execute(interaction) {
		// Force usage of staff server for commands
		if (interaction.guild.id != opsGuild) {
			await interaction.reply({
				content: 'This command must be run from the MLE Staff server',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply();

		// Fetch the user
		const userId = interaction.options.getString('user');
		const caseId = interaction.options.getInteger('case_id');
		try {
			const user = await globalThis.userUtility.fetchDatabaseUser(userId);
			// Get cases and warnings
			const [warnings, existingCases] = await Promise.all([
				globalThis.databaseManager.getWarnings(user.getUserId()),
				globalThis.databaseManager.getCasesBySubjectId(user.getUserId()),
			]);
			user.setWarnings(warnings);
			user.setCases(existingCases);
			// Filter to only include open cases
			const openCases = existingCases.filter((c) => c.getStatus() === 'OPEN');
			if (caseId !== null && caseId !== -1) {
				const kase = await globalThis.databaseManager.getCaseById(caseId);
				if (kase.getSubjectId() !== user.getUserId()) {
					await interaction.editReply({ content: `Case #${caseId} is associated with a different user.` });
					return;
				}

				await interaction.editReply({
					content: `Complete the warning details for ${user.getUserName()} in Case #${caseId}.`,
					embeds: [user.generateUserSummaryEmbed()],
					components: generateUserSummaryButtons(user.getUserId(), caseId),
				});
				return;
			}

			if (caseId === -1) {
				await interaction.editReply({
					content: `# Note\nYou have chosen to warn ${user.getUserName()} without associating a case.`,
					embeds: [user.generateUserSummaryEmbed()],
					components: generateUserSummaryButtons(user.getUserId()),
				});
				return;
			}

			if (openCases.length === 0) {
				await interaction.editReply({
					content: `# STOP!\nNo open cases found for ${user.getUserName()}. Are you sure you want to warn them without a case?`,
					embeds: [user.generateUserSummaryEmbed()],
					components: generateUserSummaryButtons(user.getUserId()),
				});
			} else if (openCases.length === 1) {
				await interaction.editReply({
					content: `# Note\nThere is exactly one open case for ${user.getUserName()}, Case [#${openCases[0].getCaseId()}](${openCases[0].getCaseThreadLink()}). Please ensure this is the correct case before proceeding. Use /warn with case ID of -1 for no case.`,
					embeds: [user.generateUserSummaryEmbed()],
					components: generateUserSummaryButtons(user.getUserId(), openCases[0].getCaseId()),
				});
			} else {
				await interaction.editReply({
					content: `# Note\nThere are multiple open cases for ${user.getUserName()} (${openCases.map((c) => `[#${c.getCaseId()}](${c.getCaseThreadLink()})`).join(', ')}). Please use /warn with the appropriate case ID.`,
					embeds: [user.generateUserSummaryEmbed()],
				});
			}
		} catch (error) {
			logger.error(`Failed to fetch user for warning: ${userId}: ${error}`);
			if (error.message === 'User not found by any identifier.') {
				await interaction.editReply({
					content: `Could not find user ${userId}`,
				});
				return;
			}
			await interaction.editReply({
				content: 'An error occurred while fetching the user.',
			});
			return;
		}
	},
};
