const log4js = require('log4js');
const logger = log4js.getLogger('WarnCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');

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
				.setDescription('The ID of the case associated with this warning')
				.setMinValue(1)
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
			if (caseId !== null) {
				const kase = await globalThis.databaseManager.getCaseById(caseId);
				if (kase.getSubjectId() !== user.getUserId()) {
					await interaction.editReply({ content: `Case #${caseId} is associated with a different user.` });
					return;
				}
			}
			user.setWarnings(await globalThis.databaseManager.getWarnings(user.getUserId()));

			await interaction.editReply({
				content: caseId
					? `Complete the warning details for ${user.getUserName()} in Case #${caseId}.`
					: `Are you sure you want to warn ${user.getUserName()} without a case? Most warnings should be handled through a case instead.`,
				embeds: [user.generateUserSummaryEmbed()],
				components: generateUserSummaryButtons(user.getUserId(), caseId),
			});
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

function generateUserSummaryButtons(dbId, caseId = null) {
	const confirmButton = new ButtonBuilder()
		.setCustomId(`userConfirmWarnButton:${dbId}:${caseId ?? ''}`)
		.setLabel('Warn User')
		.setStyle(ButtonStyle.Success);
	// TODO: Implement 'update user'
	const updateButton = new ButtonBuilder()
		.setCustomId(`userUpdateButton:${dbId}`)
		.setLabel('[Unimplemented]')
		.setStyle(ButtonStyle.Danger);
	const viewButton = new ButtonBuilder()
		.setCustomId(`userViewHistoryButton:${dbId}`)
		.setLabel('View History')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, updateButton, viewButton);
	return [actionRow];
}
