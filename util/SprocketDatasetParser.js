const log4js = require('log4js');
const logger = log4js.getLogger('SprocketDatasetParser');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const path = require('node:path');

class SprocketDatasetParser {
	constructor(remoteManager) {
		this._playersUrl = 'https://sprocket-public-datasets.nyc3.cdn.digitaloceanspaces.com/datasets/players.csv';
		this._membersUrl = 'https://sprocket-public-datasets.nyc3.cdn.digitaloceanspaces.com/datasets/members.csv';
		const localDir = process.env.MLE_WARDEN_DATA_DIR;
		if (localDir) {
			this._playersUrl = path.join(localDir, 'players.csv');
			this._membersUrl = path.join(localDir, 'members.csv');
		}
		this._remoteManager = remoteManager;
		this._logger = remoteManager._logger;
		this._cacheTtlMs = 60 * 60 * 1000;
		this._cache = new Map();
		this._inFlight = new Map();
		this._franchiseList = [
			'Aviators',
			'Bears',
			'Blizzard',
			'Bulls',
			'Comets',
			'Demolition',
			'Dodgers',
			'Ducks',
			'Eclipse',
			'Elite',
			'Express',
			'Flames',
			'Foxes',
			'Hawks',
			'Hive',
			'Hurricanes',
			'Jets',
			'Knights',
			'Lightning',
			'Outlaws',
			'Pandas',
			'Pirates',
			'Puffins',
			'Rhinos',
			'Sabres',
			'Shadow',
			'Sharks',
			'Spartans',
			'Spectre',
			'Tyrants',
			'Wizards',
			'Wolves',
		];
	}

	_isExpired(entry) {
		if (!entry) return true;
		return Date.now() - entry.fetchedAt > this._cacheTtlMs;
	}

	_getCacheKey(url) {
		return url;
	}

	async _fetchAndCache(url) {
		const key = this._getCacheKey(url);
		if (this._inFlight.has(key)) {
			return this._inFlight.get(key);
		}
		const p = (async () => {
			try {
				const csvContent = await this._remoteManager.fetch(url);

				const rawLines = csvContent
					.split(/\r?\n/)
					.map((l) => l.trim())
					.filter((l) => l.length);

				// Strip enclosing quotes from a whole line or value: "abc" -> abc
				const unquote = (s) => s.replace(/^"(.*)"$/, '$1').trim();

				// If each entire line is wrapped in quotes, remove them first
				const lines = rawLines.map((line) => unquote(line));

				const headerLine = lines[0];
				const headers = headerLine.split(',').map((h) => unquote(h).trim());

				const data = lines.slice(1).map((line) => {
					const values = line.split(',').map((v) => unquote(v).trim());
					const entry = {};
					headers.forEach((header, index) => {
						entry[header] = values[index] ?? '';
					});
					return entry;
				});

				this._cache.set(key, { data, fetchedAt: Date.now() });
				return data;
			} catch (error) {
				logger.error(`There was an error parsing CSV from URL \`${url}\`\n\`\`\`\n${error}\n\`\`\``);
				throw error;
			} finally {
				this._inFlight.delete(key);
			}
		})();
		this._inFlight.set(key, p);
		return p;
	}

	async parseCsv(url) {
		const key = this._getCacheKey(url);
		const cached = this._cache.get(key);
		if (!this._isExpired(cached)) {
			return cached.data;
		}
		return this._fetchAndCache(url);
	}

	clearCache() {
		this._cache.clear();
	}

	async getPlayersData() {
		return this.parseCsv(this._playersUrl);
	}

	async getMembersData() {
		return this.parseCsv(this._membersUrl);
	}

	async getMemberNameByDiscordId(discordId) {
		const membersData = await this.getMembersData();
		const member = membersData.find((m) => m.discord_id === discordId);
		return member ? member.name : null;
	}

	async getPlayerFranchiseByMemberName(memberName) {
		const playersData = await this.getPlayersData();
		const player = playersData.find((p) => p.name === memberName);
		// Only return franchise if in known list
		// We don't want "FMs" from FA, RFA, PEND, etc
		return player ? (this._franchiseList.includes(player.franchise) ? player.franchise : null) : null;
	}

	async getFranchiseManagerNameByFranchise(franchise) {
		const playersData = await this.getPlayersData();
		const manager = playersData.find(
			(p) => p.franchise === franchise && p['Franchise Staff Position'] === 'Franchise Manager',
		);
		return manager ? manager.name : null;
	}

	async getMemberDiscordIdByName(memberName) {
		const membersData = await this.getMembersData();
		const member = membersData.find((m) => m.name === memberName);
		return member ? member.discord_id : null;
	}

	async getPlayerFranchiseManagerDiscordIdByDiscordId(playerDiscordId) {
		const memberName = await this.getMemberNameByDiscordId(playerDiscordId);
		if (!memberName) return null;
		const franchise = await this.getPlayerFranchiseByMemberName(memberName);
		if (!franchise) return null;
		const managerName = await this.getFranchiseManagerNameByFranchise(franchise);
		if (!managerName) return null;
		const managerDiscordId = await this.getMemberDiscordIdByName(managerName);
		return managerDiscordId;
	}
}

module.exports = {
	SprocketDatasetParser,
};
