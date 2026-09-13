#!/usr/bin/env node
/**
 * One-off importer for the legacy spreadsheet-based mod history (mod-history.csv)
 * into the Warden database as Cases + Warnings (+ Punishments for bans/mutes).
 *
 * Usage:
 *   node scripts/importModHistory.js [--dry-run] [--file=./mod-history.csv] [--limit=50]
 *
 * Notes on the mapping decisions made here (legacy data is messy/free-form):
 * - The "MLEID (Violator)" column sometimes holds an MLE ID, sometimes a plain
 *   username, and occasionally an actual Discord snowflake. We detect long
 *   all-digit values (>=15 digits) as Discord IDs; everything else is treated
 *   as an MLE ID / lookup key stored in the `mle_id` column.
 * - Users table requires a unique, non-null discord_id. For violators where we
 *   only have a legacy identifier (no real Discord ID), we synthesize one as
 *   `legacy-mle-<identifier>` so the row is queryable/idempotent on re-run.
 * - "Moderators" is a free-text list of names (no Discord IDs), so we can't
 *   create real moderator User rows. All imported warnings/cases/punishments
 *   are attributed to a single synthetic "Legacy Import" moderator user, and
 *   the original moderator names + reporter + infraction date are preserved
 *   verbatim in the warning's moderator_notes for audit purposes.
 * - Rows are sorted by timestamp ascending before insert so that point totals
 *   (which are computed from prior warnings at insert time) accumulate in the
 *   correct chronological order.
 * - Each row becomes: one closed Case, one Warning, and (if "Ban?" == Yes) a
 *   'ban' Punishment, or (if a mute duration can be parsed from the warn text)
 *   a 'mute' Punishment.
 * - Re-running is safe: each warning's moderator_notes is tagged with
 *   `[legacy-import row=N]` and rows already carrying that tag are skipped.
 */

const fs = require('node:fs');
const path = require('node:path');
const log4js = require('log4js');
const { logLevel } = require('../config.json');

const logger = log4js.getLogger('ImportModHistory');
logger.level = logLevel;

const { DatabaseManager } = require('../util/DatabaseManager');
const { DatabaseResponseParser } = require('../util/DatabaseResponseParser');

const LEGACY_MODERATOR_DISCORD_ID = 'legacy-import-moderator';
const LEGACY_MODERATOR_NAME = 'Legacy Import (Historical Moderators)';

/* ------------------------------- CLI args -------------------------------- */

function parseArgs(argv) {
	const args = { dryRun: false, file: path.join(__dirname, '..', 'mod-history.csv'), limit: null };
	for (const arg of argv) {
		if (arg === '--dry-run') args.dryRun = true;
		else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length);
		else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.slice('--limit='.length), 10);
	}
	return args;
}

/* -------------------------------- CSV parsing ------------------------------ */

// Minimal RFC4180-compliant CSV parser (handles quoted fields with embedded
// commas/newlines and escaped "" quotes), needed because several fields in
// this file contain multi-paragraph quoted text.
function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];

		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
			continue;
		}

		if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\r') {
			// ignore, \n handles line breaks
		} else if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += c;
		}
	}

	// Flush trailing field/row (handles files without a trailing newline)
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function rowsToObjects(rows) {
	const [header, ...dataRows] = rows;
	return dataRows.map((row) => {
		const obj = {};
		header.forEach((col, idx) => {
			obj[col.trim()] = (row[idx] ?? '').trim();
		});
		return obj;
	});
}

/* ------------------------------ Field helpers ------------------------------ */

// Legacy dates are DD/MM/YYYY[ HH:mm:ss]; JS Date can't parse this reliably.
function parseLegacyTimestamp(str) {
	if (!str) return null;
	const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
	if (!match) return null;
	const [, day, month, year, hh = '0', mm = '0', ss = '0'] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss)));
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

function extractGreetingName(officialResponse) {
	if (!officialResponse) return null;
	const match = officialResponse.match(/Hello\s+([^\n,.!]+)/i);
	return match ? match[1].trim() : null;
}

function isDiscordSnowflake(value) {
	return /^\d{15,20}$/.test(value);
}

function extractRulesBroken(officialResponse) {
	if (!officialResponse) return null;
	const matches = [...officialResponse.matchAll(/rule\s*\*{0,2}\s*(\d+\.\d+[^\n*]{0,150})/gi)];
	if (matches.length === 0) return null;
	const unique = [...new Set(matches.map((m) => m[1].replace(/[*_]+$/g, '').trim()))];
	return unique.join('; ');
}

// Best-effort extraction of a mute duration (in days) from the warn text.
function extractMuteDurationDays(officialResponse) {
	if (!officialResponse) return null;
	const match = officialResponse.match(/(\d+)\s*(hour|day|week|month)s?\s*mute/i);
	if (!match) return null;
	const amount = Number(match[1]);
	const unit = match[2].toLowerCase();
	if (unit === 'hour') return amount >= 24 ? Math.round(amount / 24) : 1;
	if (unit === 'day') return amount;
	if (unit === 'week') return amount * 7;
	if (unit === 'month') return amount * 30;
	return null;
}

function sanitizeForDiscordId(value) {
	return `legacy-mle-${value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')}`;
}

/* --------------------------------- Main ------------------------------------ */

async function main() {
	const args = parseArgs(process.argv.slice(2));

	globalThis.databaseResponseParser = new DatabaseResponseParser();
	if (!args.dryRun) {
		globalThis.databaseManager = new DatabaseManager();
		await globalThis.databaseManager.init();
	}

	const csvText = fs.readFileSync(args.file, 'utf8');
	let entries = rowsToObjects(parseCsv(csvText));

	entries = entries
		.map((entry, idx) => ({ entry, rowNum: idx + 2 /* +1 for header, +1 for 1-based */ }))
		.filter(({ entry }) => (entry['MLEID (Violator)'] || '').trim() !== '')
		.map(({ entry, rowNum }) => ({
			entry,
			rowNum,
			timestamp: parseLegacyTimestamp(entry['Timestamp']) ?? parseLegacyTimestamp(entry['Infraction Date']),
		}))
		.sort((a, b) => (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0));

	if (args.limit) entries = entries.slice(0, args.limit);

	const stats = { total: entries.length, warningsCreated: 0, punishmentsCreated: 0, skipped: 0, failed: 0 };
	const errors = [];
	const userCache = new Map(); // key -> User

	let legacyModerator = null;
	if (!args.dryRun) {
		const { user } = await globalThis.databaseManager.createUser(LEGACY_MODERATOR_DISCORD_ID, LEGACY_MODERATOR_NAME);
		legacyModerator = user;
	}

	async function resolveViolator(mleIdRaw, displayName) {
		const cacheKey = mleIdRaw;
		if (userCache.has(cacheKey)) return userCache.get(cacheKey);

		const isSnowflake = isDiscordSnowflake(mleIdRaw);
		let user = null;

		if (args.dryRun) {
			userCache.set(cacheKey, { getUserId: () => 'DRY-RUN' });
			return userCache.get(cacheKey);
		}

		if (!isSnowflake) {
			user = await globalThis.databaseManager.getUserByIdentifier(mleIdRaw, 'mle');
		}
		if (!user) {
			const discordId = isSnowflake ? mleIdRaw : sanitizeForDiscordId(mleIdRaw);
			const { user: createdOrUpdated } = await globalThis.databaseManager.createUser(
				discordId,
				displayName || mleIdRaw,
				isSnowflake ? null : mleIdRaw,
			);
			user = createdOrUpdated;
		}

		userCache.set(cacheKey, user);
		return user;
	}

	for (const { entry, rowNum, timestamp } of entries) {
		try {
			const mleIdRaw = (entry['MLEID (Violator)'] || '').trim();
			const officialResponse = entry['Official Response (Warn command)'] || '';
			const playerAction = entry['Player Action'] || '';
			const moderators = entry['Moderators'] || 'Unknown';
			const reporter = entry['Reporter (Discord ID & Name)'] || 'N/A';
			const infractionDate = entry['Infraction Date'] || 'Unknown';
			const pointsAdded = parseInt(entry['Added Infraction Points'], 10) || 0;
			const banned = (entry['Ban?'] || '').trim().toLowerCase() === 'yes';

			if (!timestamp) {
				throw new Error('Could not parse a usable timestamp for this row');
			}

			const displayName = extractGreetingName(officialResponse);
			const violator = await resolveViolator(mleIdRaw, displayName);

			const legacyTag = `[legacy-import row=${rowNum}]`;
			const moderatorNotes = [
				legacyTag,
				`Original moderators: ${moderators}`,
				`Reporter: ${reporter}`,
				`Infraction date: ${infractionDate}`,
				'',
				officialResponse || playerAction || '(no official response text recorded)',
			].join('\n');

			if (args.dryRun) {
				logger.info(
					`[dry-run] row ${rowNum}: would warn ${displayName || mleIdRaw} (${pointsAdded} pts, ban=${banned}) at ${timestamp.toISOString()}`,
				);
				stats.warningsCreated++;
				continue;
			}

			// Idempotency check: skip if this row was already imported previously
			const existingWarnings = await globalThis.databaseManager.getWarnings(violator.getUserId());
			if (existingWarnings.some((w) => (w.getModeratorNotes?.() ?? '').includes(legacyTag))) {
				stats.skipped++;
				continue;
			}

			const kase = await globalThis.databaseManager.createCase(
				legacyModerator.getUserId(),
				violator.getUserId(),
				'CLOSED',
				timestamp.toISOString(),
				legacyModerator.getUserId(),
				`Imported from legacy mod-history.csv (row ${rowNum})`,
			);

			const warning = await globalThis.databaseManager.createWarning(
				violator.getUserId(),
				legacyModerator.getUserId(),
				extractRulesBroken(officialResponse) ?? 'Unspecified (legacy import; see notes)',
				playerAction || officialResponse.slice(0, 500) || 'See moderator notes for full legacy record',
				pointsAdded,
				moderatorNotes,
				timestamp.toISOString(),
				kase.getCaseId(),
			);
			stats.warningsCreated++;

			if (banned) {
				await globalThis.databaseManager.createPunishment(
					violator.getUserId(),
					legacyModerator.getUserId(),
					'ban',
					null,
					kase.getCaseId(),
					warning.getWarningId(),
					timestamp.toISOString(),
				);
				stats.punishmentsCreated++;
			} else {
				const muteDurationDays = extractMuteDurationDays(officialResponse);
				if (muteDurationDays) {
					await globalThis.databaseManager.createPunishment(
						violator.getUserId(),
						legacyModerator.getUserId(),
						'mute',
						muteDurationDays,
						kase.getCaseId(),
						warning.getWarningId(),
						timestamp.toISOString(),
					);
					stats.punishmentsCreated++;
				}
			}
		} catch (error) {
			stats.failed++;
			errors.push({ rowNum, mleId: entry['MLEID (Violator)'], error: String(error?.message ?? error) });
			logger.error(`Row ${rowNum} failed: ${error}`);
		}
	}

	logger.info(`Import complete${args.dryRun ? ' (dry-run)' : ''}: ${JSON.stringify(stats)}`);
	if (errors.length > 0) {
		const reportPath = path.join(__dirname, 'import-mod-history-errors.json');
		fs.writeFileSync(reportPath, JSON.stringify(errors, null, 2));
		logger.warn(`${errors.length} row(s) failed. Details written to ${reportPath}`);
	}

	process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
	logger.error('Fatal error during import:', error);
	process.exit(1);
});
