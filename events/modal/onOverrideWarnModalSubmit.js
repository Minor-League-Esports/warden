const log4js = require('log4js');
const logger = log4js.getLogger('onOverrideWarnModalSubmit');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');
const { generateWarnConfirmationButtons } = require('../../util/builders/ButtonFunctions');

async function handleOverrideWarnModalSubmit(interaction) {
	const buttonId = interaction.customId;
	const [, dbId, moderatorId, caseId] = buttonId.split(':');
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
	await interaction.followUp({
		content: `<@${interaction.user.id}> has proposed the following override action:\n${describeAction(action)}`,
	});
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
	handleOverrideWarnModalSubmit,
};
