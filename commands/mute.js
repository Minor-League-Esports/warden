const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Logger } = require('../util/Logger.js');
const { logChannelId, guildList } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('mute')
		.setDescription('Mutes a user')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addStringOption((option) =>
			option.setName('user').setDescription('The Discord ID of the user to mute').setRequired(true)
		)
		.addIntegerOption((option) =>
			option
				.setName('time')
				.setDescription('The duration to mute the user for')
				.setRequired(true)
				.setChoices(
					{ name: '7 days', value: 7 * 24 * 60 * 60 * 1000 },
					{ name: '14 days', value: 14 * 24 * 60 * 60 * 1000 },
					{ name: '28 days', value: 28 * 24 * 60 * 60 * 1000 }
				)
		),
	async execute(interaction) {
		await interaction.deferReply();
		const logChannel = await interaction.client.channels.fetch(logChannelId);
		const logger = new Logger(logChannel);
		const user = interaction.options.getString('user');
		const time = interaction.options.getInteger('time');
		const guildCache = interaction.client.guilds.cache;

		let servers = [];
		let returnString = '';

		guildList.forEach(function (guildId) {
			const guild = guildCache.get(guildId);
			if (guild === undefined) {
				returnString += `${guildId}: Error getting server\n`;
			} else {
				servers.push(guild);
			}
		});

		let members = [];
		for (const guild of servers) {
			try {
				const member = await guild.members.fetch(user);
				members.push(member);
			} catch (error) {
				if (error.rawError.message === 'Unknown Member') {
					returnString += `${guild.name}: Not in server\n`;
				} else {
					returnString += `${guild.name}: Error getting member\n`;
					logger.logMessage(
						`Error fetching member ${user}} in ${guild.name}!\n\`\`\`\n${error}\n\`\`\``
					);
				}
			}
		}

		for (const member of members) {
			try {
				await member.timeout(time);
				returnString += `${member.guild.name}: Success\n`;
			} catch (error) {
				returnString += `${member.guild.name}: Error timing out member\n`;
				logger.logMessage(
					`Error timing out ${member} in ${member.guild.name}!\n\`\`\`\n${error}\n\`\`\``
				);
			}
		}

		await interaction.editReply(returnString);
	}
};
