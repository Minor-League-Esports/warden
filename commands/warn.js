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

		// await globalThis.databaseManager.createWarning(732, 732, 732, 'Test private reason', 'Test public reason', 2);

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
								.createUser(userId, discordUser.username)
								.then(async () => {
									await interaction.followUp({
										content: `Created new user entry for ${discordUser.username} with ID ${userId}.`,
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
		.setCustomId('userConfirmButton')
		.setLabel('Confirm User')
		.setStyle(ButtonStyle.Success);
	const updateButton = new ButtonBuilder()
		.setCustomId('userUpdateButton')
		.setLabel('Update User')
		.setStyle(ButtonStyle.Danger);
	const viewButton = new ButtonBuilder()
		.setCustomId('userViewButton')
		.setLabel('View History')
		.setStyle(ButtonStyle.Primary);
	const actionRow = new ActionRowBuilder().addComponents(confirmButton, updateButton, viewButton);
	return [actionRow];
}
