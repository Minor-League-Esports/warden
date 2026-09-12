const log4js = require('log4js');
const logger = log4js.getLogger('onClientReady');
const {
	logLevel,
	opsLogChannelId,
	caseLogChannelId,
	caseChannelId,
	reportChannelId,
	reportEvidenceChannelId,
} = require('../config.json');
logger.level = logLevel;

const { Events } = require('discord.js');
const { DiscordLogger } = require('../util/DiscordLogger.js');
const { CaseLogger } = require('../util/CaseLogger.js');
const { PunishmentExecutor } = require('../util/PunishmentExecutor.js');
const { UserUtility } = require('../util/UserUtility.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		// Helper to ensure we log to Discord (if possible) and then exit
		const gracefulExit = async (discordLoggerInstance, message, code = 1) => {
			try {
				if (discordLoggerInstance) {
					await discordLoggerInstance.logMessage(message);
				}
			} catch (logErr) {
				logger.error('Failed to send failure message to Discord', logErr);
			} finally {
				// Give the Discord client a brief moment to flush, then exit
				setTimeout(() => {
					process.exit(code);
				}, 250);
			}
		};

		const discordLogger = new DiscordLogger(client, opsLogChannelId);
		try {
			await discordLogger.init();
		} catch (error) {
			logger.error('Failed to initialize DiscordLogger', error);
			// Cannot log to Discord without logger; exit immediately
			setTimeout(() => process.exit(1), 100);
			return;
		}

		globalThis.discordLogger = discordLogger;

		try {
			await globalThis.databaseManager.init();
			await discordLogger.logMessage('Database Manager initialized');
			globalThis.userUtility = new UserUtility(client, globalThis.databaseManager);
		} catch (error) {
			logger.error(error);
			await gracefulExit(discordLogger, 'FATAL: Database Manager failed to initialize!');
			return;
		}

		try {
			const caseLogChannel = await client.channels.fetch(caseLogChannelId);
			globalThis.caseLogger = new CaseLogger(caseLogChannel);
			globalThis.punishmentExecutor = new PunishmentExecutor(client, globalThis.caseLogger);
			const reportChannel = await client.channels.fetch(reportChannelId);
			const reportEvidenceChannel = await client.channels.fetch(reportEvidenceChannelId);
			const caseChannel = await client.channels.fetch(caseChannelId);
			globalThis.reportChannel = reportChannel;
			globalThis.reportEvidenceChannel = reportEvidenceChannel;
			globalThis.caseChannel = caseChannel;
			await discordLogger.logMessage('Case Logger initialized');
		} catch (error) {
			logger.error('Failed to initialize CaseLogger', error);
			await gracefulExit(discordLogger, 'FATAL: Case Logger failed to initialize!');
			return;
		}

		discordLogger.logMessage('Bot is online');
		logger.info(`Ready! Logged in as ${client.user.tag}`);
	},
};
