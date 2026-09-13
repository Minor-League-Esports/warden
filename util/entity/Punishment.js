const log4js = require('log4js');
const logger = log4js.getLogger('Punishment');
const { logLevel } = require('../../config.json');
logger.level = logLevel;

const { EmbedBuilder } = require('discord.js');
const { getContributingWarnings, chunkTextPreserveNewlines } = require('../UtilFunctions');

class Punishment {
	// Getters and setters
	setPunishmentId(punishmentId) {
		this._punishmentId = punishmentId;
	}

	getPunishmentId() {
		return this._punishmentId;
	}

	setSubjectId(subjectId) {
		this._subjectId = subjectId;
	}

	getSubjectId() {
		return this._subjectId;
	}

	setModeratorId(moderatorId) {
		this._moderatorId = moderatorId;
	}

	getModeratorId() {
		return this._moderatorId;
	}

	/**
	 * Setter for the User who was punished
	 * @param {User} user
	 */
	setSubject(user) {
		this._subject = user;
	}

	/**
	 * Getter for the User who was punished
	 * @returns {User}
	 */
	getSubject() {
		return this._subject;
	}

	/**
	 * Setter for the User who issued the punishment
	 * @param {User} user
	 */
	setModerator(user) {
		this._moderator = user;
	}

	/**
	 * Getter for the User who issued the punishment
	 * @returns {User}
	 */
	getModerator() {
		return this._moderator;
	}

	setCaseId(caseId) {
		this._caseId = caseId;
	}

	getCaseId() {
		return this._caseId ?? 'N/A';
	}

	setWarningId(warningId) {
		this._warningId = warningId;
	}

	getWarningId() {
		return this._warningId ?? null;
	}

	/**
	 * Setter for Case object
	 * @param {Case} kase
	 */
	setCase(kase) {
		this._case = kase;
	}

	/**
	 * Getter for Case object
	 * @returns {Case}
	 */
	getCase() {
		return this._case;
	}

	setTimestamp(timestamp) {
		this._timestamp = timestamp;
	}

	getTimestamp() {
		return this._timestamp;
	}

	setType(type) {
		this._type = type;
	}

	getType() {
		return this._type;
	}

	setDuration(duration) {
		this._duration = duration;
	}

	getDuration() {
		return this._duration ?? null;
	}

	/**
	 * Getter for friendly string
	 *
	 * @returns {String}
	 */
	getFriendlyString() {
		if (this._type === 'ban') {
			return `Ban from the Minor League Esports Community and League
            \nIf you wish to appeal this ban, you may do so in 6 months. 
            Any early appeals will be denied and you will not be able to appeal for another 180 days. 
            You can find the appeal form [at this link](<https://dyno.gg/form/28376717>).`;
		} else if (this._type === 'mute') {
			return `${this._duration} day mute within the MLE Community`;
		} else if (this._type === 'suspension') {
			return `${this._duration} week suspension from all MLE League Play`;
		} else if (this._type === 'warning') {
			return 'Official warning';
		} else if (this._type === 'unmute') {
			return 'Unmute within the MLE Community';
		} else if (this._type === 'unban') {
			return 'Unban from the MLE Community and League';
		} else {
			return 'Unknown';
		}
	}

	/**
	 * Generates an embed for moderator view of a standalone punishment
	 *
	 * @param {String|null} caseLink Optional jump link to the case's discussion thread
	 * @param {String} reporters Names of reporters attached to the parent case
	 * @returns {EmbedBuilder}
	 */
	generatePrivateEmbed(caseLink = null, reporters = 'None') {
		const caseValue = this.getCaseId() && this.getCaseId() !== 'N/A'
			? (caseLink ? `[#${this.getCaseId()}](${caseLink})` : `#${this.getCaseId()}`)
			: 'None';
		const embed = new EmbedBuilder()
			.setTitle(`${this.getSubject()?.getUserName() ?? 'User'} | Punishment`)
			.setTimestamp(new Date(this.getTimestamp()))
			.addFields(
				{ name: 'Type', value: String(this.getType() ?? 'Unknown'), inline: true },
				{ name: 'Duration', value: String(this.getDuration() ?? 'N/A'), inline: true },
				{ name: 'Details', value: String(this.getFriendlyString() ?? 'None') },
				{ name: 'Moderator Name', value: String(this.getModerator()?.getUserName() ?? 'None'), inline: true },
				{ name: 'Case', value: caseValue, inline: true },
				{ name: 'Reporters', value: String(reporters), inline: true },
				{ name: 'Warning ID', value: String(this.getWarningId() ?? 'None'), inline: true },
			)
			.setFooter({ text: `ID: ${this.getSubject()?.getDiscordId() ?? 'Unknown'}` })
			.setThumbnail(this.getSubject()?.getDiscordAvatar() ?? null)
			.setColor('#ff0000');
		return embed;
	}

	generateUserEmbed() {
		let friendlyType;
		if (this._type === 'ban') {
			friendlyType = 'banned';
		} else if (this._type === 'mute') {
			friendlyType = 'muted';
		} else if (this._type === 'suspension') {
			friendlyType = 'suspended';
		} else if (this._type === 'unmute') {
			friendlyType = 'unmuted';
		} else if (this._type === 'unban') {
			friendlyType = 'unbanned';
		} else {
			friendlyType = 'punished';
		}
		const embed = new EmbedBuilder()
			.setTitle(`You have been ${friendlyType} by MLE Moderation`)
			.setTimestamp()
			.setColor('#ff0000')
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');

		if (this._type === 'mute') {
			embed.setDescription(`You have been muted in MLE for ${this.getDuration()} day(s).`);
		} else if (this._type === 'suspension') {
			embed.setDescription(`You have been suspended from all MLE League Play for ${this.getDuration()} week(s).`);
		} else if (this._type === 'ban') {
			embed.setDescription('You have been banned from the Minor League Esports Community and League.');
		} else if (this._type === 'unmute') {
			embed.setDescription('You have been unmuted in MLE.');
		} else if (this._type === 'unban') {
			embed.setDescription('You have been unbanned from the Minor League Esports Community and League.');
		} else {
			embed.setDescription('You have received a punishment from MLE Moderation.');
		}
		return embed;
	}

	/**
	 * Generates a public-facing announcement embed for bans.
	 * Includes a list of warnings that contribute to the user's current point total
	 * at the time of the ban. Uses 90-day decay rules.
	 * @returns {Promise<EmbedBuilder>}
	 */
	async generateAnnouncementEmbed(options = {}) {
		const embed = new EmbedBuilder()
			.setColor('#ff0000')
			.setTimestamp()
			.setThumbnail('https://mlesports.gg/wp-content/uploads/logo-mle-256.png');

		const user = this.getSubject();
		const asOf = this.getTimestamp() ?? new Date().toISOString();

		const onProbation = Boolean(options.onProbation);
		const thresholdText = onProbation ? '3 or more mod points while on probation' : '5 or more mod points';
		embed.setTitle('Community Notice: Ban Issued');
		embed.setDescription(
			`${
				user?.getUserName() ?? 'A member'
			} has been banned from MLE for accumulating ${thresholdText}.\nThey violated rules:`,
		);

		try {
			const dbUserId = user?.getUserId();
			let warnings = [];
			if (dbUserId) {
				warnings = await globalThis.databaseManager.getWarnings(dbUserId);
			}

			// Determine contributing warnings at the time of the ban
			const contributing = getContributingWarnings(warnings, asOf);

			// Build a readable list of rules broken only (no timestamps/points/content)
			if (contributing.length > 0) {
				const lines = contributing
					.sort((a, b) => new Date(a.getTimestamp()).getTime() - new Date(b.getTimestamp()).getTime())
					.map((w) => String(w.getRulesBroken() ?? ''))
					.filter((s) => s.trim().length > 0)
					.join('\n');

				const chunks = chunkTextPreserveNewlines(lines, 1024);
				for (let i = 0; i < chunks.length; i++) {
					embed.addFields({ name: i === 0 ? 'Rules' : 'Rules (cont.)', value: chunks[i] });
				}
			} else {
				embed.addFields({ name: 'Rules', value: 'None found' });
			}
		} catch (error) {
			logger.error('Failed to retrieve warnings for punishment announcement embed', error);
			// If warning retrieval fails, still send a basic announcement
			embed.addFields({ name: 'Rules', value: 'Unavailable', inline: false });
		}

		// Footer
		embed.setFooter({ text: `ID: ${user?.getDiscordId() ?? 'Unknown'}` });
		return embed;
	}
}

module.exports = Punishment;
