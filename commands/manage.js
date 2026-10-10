const log4js = require('log4js');
const logger = log4js.getLogger('ManageCommand');
const { logLevel, opsGuild } = require('../config.json');
logger.level = logLevel;

const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');

const caseHandlers = require('../util/manage/ManageCaseHandlers').handlers;
const reportHandlers = require('../util/manage/ManageReportHandlers').handlers;
const warningHandlers = require('../util/manage/ManageWarningHandlers').handlers;
const punishmentHandlers = require('../util/manage/ManagePunishmentHandlers').handlers;
const userHandlers = require('../util/manage/ManageUserHandlers').handlers;

const HANDLERS = {
	case: caseHandlers,
	report: reportHandlers,
	warning: warningHandlers,
	punishment: punishmentHandlers,
	user: userHandlers,
};

// These respond with a modal, which has to be the first response to the interaction
const MODAL_SUBCOMMANDS = new Set(['note', 'reply']);

const idOption = (name, description) => (option) =>
	option.setName(name).setDescription(description).setMinValue(1).setRequired(true);

const userOption = (description = 'The user (name, Discord ID, or MLE ID)') => {
	return (option) => option.setName('user').setDescription(description).setRequired(true);
};

const statusOption = (option) =>
	option
		.setName('status')
		.setDescription('Filter by status')
		.addChoices(
			{ name: 'Open (default)', value: 'open' },
			{ name: 'Closed', value: 'closed' },
			{ name: 'All', value: 'all' },
		);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('manage')
		.setDescription('Manage cases, reports, warnings, punishments, and users')
		.setContexts([InteractionContextType.Guild])
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addSubcommandGroup((group) =>
			group
				.setName('case')
				.setDescription('Manage cases')
				.addSubcommand((sub) =>
					sub
						.setName('create')
						.setDescription('Create a case without an attached report')
						.addStringOption(userOption('The user who is the subject of the case')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('details')
						.setDescription('Show a case and all of its linked records')
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) => sub.setName('list').setDescription('List all cases').addStringOption(statusOption))
				.addSubcommand((sub) =>
					sub
						.setName('assign')
						.setDescription('Assign a case to a moderator')
						.addIntegerOption(idOption('case_id', 'The case number'))
						.addStringOption((option) =>
							option
								.setName('moderator')
								.setDescription('Moderator identifier (Discord ID, MLE ID, or username)')
								.setRequired(true),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('close')
						.setDescription('Close a case after confirmation')
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('note')
						.setDescription('Add a moderator note to a case')
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('attach')
						.setDescription('Attach a report, warning, or punishment to a case')
						.addStringOption((option) =>
							option
								.setName('type')
								.setDescription('What to attach')
								.setRequired(true)
								.addChoices(
									{ name: 'Report', value: 'report' },
									{ name: 'Warning', value: 'warning' },
									{ name: 'Punishment', value: 'punishment' },
								),
						)
						.addIntegerOption(idOption('id', 'The report, warning, or punishment number'))
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('detach')
						.setDescription('Detach a report, warning, or punishment from its case')
						.addStringOption((option) =>
							option
								.setName('type')
								.setDescription('What to detach')
								.setRequired(true)
								.addChoices(
									{ name: 'Report', value: 'report' },
									{ name: 'Warning', value: 'warning' },
									{ name: 'Punishment', value: 'punishment' },
								),
						)
						.addIntegerOption(idOption('id', 'The report, warning, or punishment number')),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('report')
				.setDescription('Manage reports')
				.addSubcommand((sub) =>
					sub
						.setName('details')
						.setDescription('Show a report')
						.addIntegerOption(idOption('report_id', 'The report number')),
				)
				.addSubcommand((sub) => sub.setName('list').setDescription('List all reports').addStringOption(statusOption))
				.addSubcommand((sub) =>
					sub
						.setName('close')
						.setDescription('Close a report after confirmation')
						.addIntegerOption(idOption('report_id', 'The report number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('note')
						.setDescription('Add a moderator note to a report')
						.addIntegerOption(idOption('report_id', 'The report number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('reply')
						.setDescription('Reply to a report')
						.addIntegerOption(idOption('report_id', 'The report number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('attach')
						.setDescription('Attach a report to a case')
						.addIntegerOption(idOption('report_id', 'The report number'))
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('detach')
						.setDescription('Detach a report from its case')
						.addIntegerOption(idOption('report_id', 'The report number')),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('warning')
				.setDescription('Manage warnings')
				.addSubcommand((sub) =>
					sub
						.setName('details')
						.setDescription('Show a warning')
						.addIntegerOption(idOption('warning_id', 'The warning number')),
				)
				.addSubcommand((sub) =>
					sub.setName('list').setDescription("List a user's warnings").addStringOption(userOption()),
				)
				.addSubcommand((sub) =>
					sub
						.setName('note')
						.setDescription('Add a moderator note to a warning')
						.addIntegerOption(idOption('warning_id', 'The warning number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('attach')
						.setDescription('Attach a warning to a case')
						.addIntegerOption(idOption('warning_id', 'The warning number'))
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('detach')
						.setDescription('Detach a warning from its case')
						.addIntegerOption(idOption('warning_id', 'The warning number')),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('punishment')
				.setDescription('Manage punishments')
				.addSubcommand((sub) =>
					sub
						.setName('details')
						.setDescription('Show a punishment')
						.addIntegerOption(idOption('punishment_id', 'The punishment number')),
				)
				.addSubcommand((sub) =>
					sub.setName('list').setDescription("List a user's punishments").addStringOption(userOption()),
				)
				.addSubcommand((sub) =>
					sub
						.setName('attach')
						.setDescription('Attach a punishment to a case')
						.addIntegerOption(idOption('punishment_id', 'The punishment number'))
						.addIntegerOption(idOption('case_id', 'The case number')),
				)
				.addSubcommand((sub) =>
					sub
						.setName('detach')
						.setDescription('Detach a punishment from its case')
						.addIntegerOption(idOption('punishment_id', 'The punishment number')),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('user')
				.setDescription('Manage users')
				.addSubcommand((sub) =>
					sub.setName('details').setDescription("Show a user's info and history summary").addStringOption(userOption()),
				)
				.addSubcommand((sub) =>
					sub
						.setName('set_mle_id')
						.setDescription("Set a user's MLE ID")
						.addStringOption(userOption())
						.addStringOption((option) =>
							option.setName('mle_id').setDescription('The MLE ID to assign').setRequired(true),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('set_discord_id')
						.setDescription("Set a user's Discord ID (e.g. after they switch accounts)")
						.addStringOption(userOption())
						.addStringOption((option) =>
							option.setName('discord_id').setDescription('The new Discord ID').setRequired(true),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('set_username')
						.setDescription("Set a user's username")
						.addStringOption(userOption())
						.addStringOption((option) =>
							option.setName('username').setDescription('The new username').setRequired(true),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('set_discord_username')
						.setDescription("Set a user's Discord handle")
						.addStringOption(userOption())
						.addStringOption((option) =>
							option.setName('discord_username').setDescription('The Discord handle').setRequired(true),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('set_alternate_identifier')
						.setDescription("Set a user's alternate identifier (any other name they can be looked up by)")
						.addStringOption(userOption())
						.addStringOption((option) =>
							option.setName('alternate_identifier').setDescription('The alternate identifier').setRequired(true),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('merge')
						.setDescription('Merge a duplicate profile into another and delete it')
						.addStringOption((option) =>
							option
								.setName('source')
								.setDescription('The profile to merge away and delete (name, Discord ID, or MLE ID)')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('target')
								.setDescription('The profile to keep (name, Discord ID, or MLE ID)')
								.setRequired(true),
						),
				),
		),
	async execute(interaction) {
		if (interaction.guildId !== opsGuild) {
			await interaction.reply({
				content: 'This command must be run from the MLE Staff server.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const group = interaction.options.getSubcommandGroup();
		const subcommand = interaction.options.getSubcommand();
		const handler = HANDLERS[group]?.[subcommand];
		if (!handler) {
			await interaction.reply({ content: 'Unknown manage subcommand.', flags: MessageFlags.Ephemeral });
			return;
		}

		try {
			if (!MODAL_SUBCOMMANDS.has(subcommand)) await interaction.deferReply();
			await handler(interaction);
		} catch (error) {
			logger.error(`Error executing manage ${group} ${subcommand}: ${error}`);
			const content = 'Unable to complete that operation.';
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content });
			} else {
				await interaction.reply({ content, flags: MessageFlags.Ephemeral });
			}
		}
	},
};
