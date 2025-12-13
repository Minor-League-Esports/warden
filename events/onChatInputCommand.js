const log4js = require('log4js');
const logger = log4js.getLogger('onChatInputCommand');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const { Events, MessageFlags } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			logger.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			logger.error(error);
			globalThis.discordLogger.logMessage('A command encountered an error!');
			globalThis.discordLogger.logMessage(`Interaction: \n\`\`\`\n${interaction.toString()}\n\`\`\``);
			globalThis.discordLogger.logMessage(`Error: \n\`\`\`\n${error}\n\`\`\``);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			} else {
				await interaction.reply({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};
