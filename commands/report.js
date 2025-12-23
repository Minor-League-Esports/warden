const log4js = require('log4js');
const logger = log4js.getLogger('ReportCommand');
const { logLevel, modmailUserId } = require('../config.json');
logger.level = logLevel;

const {
	SlashCommandBuilder,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	EmbedBuilder,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder().setName('report').setDescription('Make a report to MLE Moderation'),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const user = await globalThis.userUtility.fetchDatabaseUser(interaction.user.id);
			const reportEmbed = generateReportEmbed();
			const buttons = generateReportButtons(user.getUserId());
			await interaction.user.send({
				embeds: [reportEmbed],
				components: buttons,
			});
			await interaction.editReply({
				content: 'The report form has been sent to your DMs!',
			});
		} catch (error) {
			logger.error(`Error executing report command: ${error}`);
			await interaction.editReply({
				content: `Something went wrong, try again. Message <@${modmailUserId}> if the issue persists.`,
			});
			return;
		}
	},
};

function generateReportEmbed() {
	const reportEmbed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle('Report User')
		.setDescription(
			`Use the button below to report a user to MLE Moderation. Please provide as much detail as possible in your report to help us address the issue effectively.\n
            For the "Who are you reporting?" field, you can enter the MLE Username, Discord ID, or MLE ID of the user you wish to report.\n
            After submitting the report form, you will have the opportunity to attach any relevant files or screenshots in the following steps.`,
		)
		.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png')
		.setFooter({ text: 'Thank you for helping us keep the community safe!' })
		.setTimestamp();
	return reportEmbed;
}

function generateReportButtons(dbId) {
	const reportButton = new ButtonBuilder()
		.setCustomId(`userReportButton:${dbId}`)
		.setLabel('Report User')
		.setStyle(ButtonStyle.Success);
	const actionRow = new ActionRowBuilder().addComponents(reportButton);
	return [actionRow];
}
