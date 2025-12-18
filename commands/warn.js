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
			option
				.setName('user')
				.setDescription('The Discord ID of the user to warn')
				.setRequired(true)
				.setMinLength(17)
				.setMaxLength(19),
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

		const userId = interaction.options.getString('user');

		// await globalThis.databaseManager.createWarning(
		// 	727,
		// 	942,
		// 	75,
		// 	'1.1(2) Comments that are moderately insulting',
		// 	'Saying "Fuck you, you piece of shit" in gen chat',
		// 	2,
		// 	'Some private notes here',
		// 	new Date('2025-06-10T15:01:00.191-05:00'),
		// );

		// await globalThis.databaseManager.createWarning(
		// 	727,
		// 	625,
		// 	285,
		// 	'1.10(1) Directly accusing a player or team of violating competitive integrity',
		// 	'Saying "Delta is literally throwing scrims to stay as a 5 sal" in a twitch chat',
		// 	1,
		// 	"I mean delta really shouldn't be a 5 sal but rules are rules",
		// 	new Date('2025-10-02T15:01:42.570-05:00'),
		// );

		// await globalThis.databaseManager.createWarning(
		// 	727,
		// 	833,
		// 	267,
		// 	'1.10(1) Directly accusing a player or team of violating competitive integrity',
		// 	'here goes',
		// 	1,
		// 	"another one",
		// 	new Date('2025-10-22T15:01:42.570-05:00'),
		// );

		// await globalThis.databaseManager.createWarning(
		// 	727,
		// 	999,
		// 	251,
		// 	'1.3(4) Mildly bigoted remarks or slurs',
		// 	'Using the R-slur in a general chat',
		// 	4,
		// 	'(direct quote)',
		// 	new Date('2025-12-09T11:09:42.570-05:00'),
		// );

		interaction.client.users
			.fetch(userId)
			.then(async (discordUser) => {
				globalThis.databaseManager
					.getUserByDiscordId(userId)
					.then(async (dbUser) => {
						await interaction.editReply({
							embeds: [dbUser.generateUserSummaryEmbed()],
							components: generateUserSummaryButtons(),
						});
					})
					.catch(async (error) => {
						if (error === 'User not found') {
							// User not found in DB, create new user entry
							await interaction.editReply({
								content: `User with ID ${userId} not found in database. Creating new user entry...`,
							});
							globalThis.databaseManager
								.createUser(userId, discordUser.username, null, discordUser.displayAvatarURL())
								.then(async (user) => {
									await interaction.followUp({
										embeds: [user['user'].generateUserSummaryEmbed()],
										components: generateUserSummaryButtons(),
									});
								})
								.catch(async (creationError) => {
									logger.error('Error creating user for warn command:', creationError);
									await interaction.followUp({
										content: `An error occurred while creating a new user with ID ${userId}.`,
									});
								});
						} else {
							logger.error('Error fetching user for warn command:', error);
							await interaction.editReply({
								content: `An error occurred while fetching the user with ID ${userId}.`,
							});
						}
					});
			})
			.catch(async (error) => {
				if (error.code === 10013) {
					await interaction.editReply({
						content: `Failed to find user with ID ${userId}`,
					});
				} else {
					logger.error(error);
					await interaction.editReply({ content: 'An unknown error occurred' });
					globalThis.discordLogger.logMessage(`Unknown error warning ${userId}!\n\`\`\`\n${error}\n\`\`\``);
				}
			});
	},
};

function generateUserSummaryButtons() {
	const confirmButton = new ButtonBuilder()
		.setCustomId('userConfirmWarnButton')
		.setLabel('Warn User')
		.setStyle(ButtonStyle.Success);
	const updateButton = new ButtonBuilder()
		.setCustomId('userUpdateButton')
		.setLabel('Update User')
		.setStyle(ButtonStyle.Danger);
	const viewButton = new ButtonBuilder()
		.setCustomId('userViewHistoryButton')
		.setLabel('View History')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, updateButton, viewButton);
	return [actionRow];
}
