const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token, logLevel } = require('./config.json');
const log4js = require('log4js');
const eventLogger = log4js.getLogger('EventWrapper');
eventLogger.level = logLevel;
const { DatabaseManager } = require('./util/DatabaseManager');
const { RemoteManager } = require('./util/RemoteManager.js');
const { SprocketDatasetParser } = require('./util/SprocketDatasetParser.js');
const { DatabaseResponseParser } = require('./util/DatabaseResponseParser.js');

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);

	// Wrap all event handlers in try/catch to prevent crashes
	const handler = async (...args) => {
		try {
			await event.execute(...args);
		} catch (err) {
			eventLogger.error(`Error in event handler "${event.name}":`, err);
			try {
				if (globalThis.discordLogger) {
					await globalThis.discordLogger.logMessage(`Error in event handler "${event.name}": ${err}`);
				}
			} catch (logErr) {
				eventLogger.error('Failed to log event error to Discord', logErr);
			}
		}
	};

	if (event.once) {
		client.once(event.name, handler);
	} else {
		client.on(event.name, handler);
	}
}

client.login(token);

globalThis.databaseManager = new DatabaseManager();
globalThis.databaseResponseParser = new DatabaseResponseParser();
globalThis.remoteManager = new RemoteManager();
globalThis.sprocketDatasetParser = new SprocketDatasetParser(globalThis.remoteManager);
globalThis.discordLogger = null;
globalThis.caseLogger = null;
globalThis.caseChannel = null;
globalThis.reportChannel = null;
globalThis.reportEvidenceChannel = null;
globalThis.punishmentExecutor = null;
globalThis.userUtility = null;

// Global process-level guards to avoid full bot crashes
process.on('unhandledRejection', (reason, promise) => {
	eventLogger.error('Unhandled promise rejection:', { reason, promise });
});

process.on('uncaughtException', (error) => {
	eventLogger.error('Uncaught exception:', error);
});
