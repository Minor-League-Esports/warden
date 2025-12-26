const log4js = require('log4js');
const logger = log4js.getLogger('onReportButtonClick');
const { logLevel, moderatorRoleId } = require('../config.json');
logger.level = logLevel;

const { Events, ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isButton()) return;

		const buttonId = interaction.customId;

		if (buttonId.startsWith('userReportButton:')) {
			const [, dbId] = buttonId.split(':');

			const modal = new ModalBuilder().setCustomId(`reportUserModal:${dbId}`).setTitle('Report User');

			const subjectInput = new TextInputBuilder()
				.setCustomId('subject')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('TheGamingBear')
				.setRequired(true);
			const subjectLabel = new LabelBuilder().setLabel('Who are you reporting?').setTextInputComponent(subjectInput);

			const reasonInput = new TextInputBuilder()
				.setCustomId('reason')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('What rule(s) did they break and why are you reporting them?')
				.setRequired(true);
			const reasonInputLabel = new LabelBuilder().setLabel('Reason for Report').setTextInputComponent(reasonInput);

			const evidenceInput = new TextInputBuilder()
				.setCustomId('evidence')
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder('Paste links here if available. You can attach files afterwards with `/report evidence`.')
				.setRequired(false);
			const evidenceInputLabel = new LabelBuilder().setLabel('Evidence (if any)').setTextInputComponent(evidenceInput);

			modal.addLabelComponents(subjectLabel, reasonInputLabel, evidenceInputLabel);

			await interaction.showModal(modal);
		}

		if (buttonId.startsWith('confirmReportSubmit:')) {
			const [, subjectId, reporterId] = buttonId.split(':');
			const embed = interaction.message.embeds[0];

			if (!embed) {
				logger.warn('No embed found in the interaction message during report confirmation.');
				await interaction.reply({
					content: 'There was an error with the report submission. Please try again later.',
				});
				return;
			}
			const reasonFields = embed.fields.filter((field) => field.name.startsWith('Report Reason'));
			const evidenceFields = embed.fields.filter((field) => field.name.startsWith('Evidence'));

			if (!(reasonFields.length > 0 && evidenceFields.length > 0)) {
				logger.warn('Required fields missing in the embed during report confirmation.');
				await interaction.reply({
					content: 'There was an error with the report submission. Please try again later.',
				});
				return;
			}

			const reason = reasonFields
				.map((field) => field.value)
				.join('\n')
				.trim();
			if (reason.length === 0) {
				logger.warn('Empty report reason provided during report confirmation.');
				await interaction.reply({
					content: 'The report reason cannot be empty. Please try again.',
				});
				return;
			}
			const evidence = evidenceFields
				.map((field) => field.value)
				.join('\n')
				.trim();
			if (evidence.length === 0) {
				logger.warn('Empty report evidence provided during report confirmation.');
				await interaction.reply({
					content: 'The report evidence cannot be empty. Please try again.',
				});
				return;
			}

			await interaction.deferUpdate();

			globalThis.databaseManager
				.createReport(subjectId, reporterId, reason, evidence)
				.then(async (report) => {
					const reportModEmbed = await report.generatePrivateEmbed();
					await globalThis.reportChannel.send({
						content: `<@&${moderatorRoleId}>\nNew report submitted`,
						embeds: [reportModEmbed],
					});

					const reportUserEmbed = await report.generateUserEmbed();
					await interaction.editReply({ components: [] });
					await interaction.followUp({
						content: 'Your report has been submitted to MLE Moderation. Thank you for helping keep the community safe!',
						embeds: [reportUserEmbed],
						components: [],
					});
				})
				.catch(async (error) => {
					logger.error(`Error creating report in database: ${error}`);
					await interaction.editReply({ components: [] });
					await interaction.followUp({ content: 'There was an error submitting your report. Please try again later.' });
				});
		}
	},
};
