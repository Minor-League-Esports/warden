const log4js = require('log4js');
const logger = log4js.getLogger('InteractionCreate');
const { logLevel, opsLogChannelId } = require('../config.json');
logger.level = logLevel;

const { Events, MessageFlags } = require('discord.js');
const { DiscordLogger } = require('../util/DiscordLogger.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		// Set up loggers
		const client = interaction.client;
		const discordLogger = new DiscordLogger(client, opsLogChannelId);
		try {
			await discordLogger.init();
		} catch (error) {
			logger.warn('Failed to initialize DiscordLogger', error);
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			logger.error(error);
			discordLogger.logMessage('A command encountered an error!');
			discordLogger.logMessage(`Interaction: \n\`\`\`\n${interaction.toString()}\n\`\`\``);
			discordLogger.logMessage(`Error: \n\`\`\`\n${error}\n\`\`\``);
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
