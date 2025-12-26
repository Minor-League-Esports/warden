const log4js = require('log4js');
const logger = log4js.getLogger('UtilFunctions');
const { logLevel } = require('../config.json');
logger.level = logLevel;

// Resolve stored Discord message URLs into a list of links for display.
// Preference: include the original message jump URL first, then any current CDN attachment URLs.
// Falls back gracefully if fetching fails.
async function resolveEvidenceLinks(rawEvidence) {
	try {
		if (!rawEvidence || rawEvidence === 'N/A') {
			return [];
		}

		const lines = String(rawEvidence)
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0);

		const results = [];
		for (const url of lines) {
			// Always include the message jump URL first
			results.push(url);

			const match = url.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
			const messageId = match ? match[3] : null;

			if (!messageId) {
				continue;
			}

			if (!globalThis.reportEvidenceChannel) {
				continue;
			}

			try {
				const message = await globalThis.reportEvidenceChannel.messages.fetch(messageId);
				const attachCount = message?.attachments?.size ?? 0;
				logger.debug(`resolveEvidenceLinks: fetched message ${messageId}; attachments=${attachCount}`);

				if (attachCount > 0) {
					for (const attachment of message.attachments.values()) {
						results.push(String(attachment.url));
					}
				}
			} catch (err) {
				logger.warn(`resolveEvidenceLinks: failed to fetch message ${messageId}: ${err}`);
				// Keep just the message URL on failure
			}
		}

		logger.debug(`resolveEvidenceLinks: completed with ${results.length} link(s)`);
		return results;
	} catch (e) {
		logger.error('resolveEvidenceLinks: unexpected error', e);
		return [];
	}
}

// Resolve evidence for user-facing embeds: only include current CDN attachment URLs.
// Users typically cannot access the evidence channel, so omit jump URLs entirely.
async function resolveEvidenceLinksForUser(rawEvidence) {
	try {
		if (!rawEvidence || rawEvidence === 'N/A') {
			return [];
		}
		const lines = String(rawEvidence)
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		const cdnLinks = [];
		for (const url of lines) {
			const match = url.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
			const messageId = match ? match[3] : null;
			if (!messageId) {
				continue;
			}
			if (!globalThis.reportEvidenceChannel) {
				continue;
			}
			try {
				const message = await globalThis.reportEvidenceChannel.messages.fetch(messageId);
				const attachCount = message?.attachments?.size ?? 0;
				if (attachCount > 0) {
					for (const attachment of message.attachments.values()) {
						cdnLinks.push(String(attachment.url));
					}
				}
			} catch (err) {
				logger.warn(`resolveEvidenceLinksForUser: failed to fetch message ${messageId}: ${err}`);
			}
		}
		logger.debug(`resolveEvidenceLinksForUser: completed with ${cdnLinks.length} CDN link(s)`);
		return cdnLinks;
	} catch (e) {
		logger.error('resolveEvidenceLinksForUser: unexpected error', e);
		return [];
	}
}

// Resolve evidence for moderator-facing embeds: one line per attachment as
// "<cdn_url> (<jump_url>)". If fetching fails or there are no attachments,
// include the original jump URL as a fallback.
async function resolveEvidenceLinksForModerators(rawEvidence) {
	try {
		logger.debug('resolveEvidenceLinksForModerators: start');
		if (!rawEvidence || rawEvidence === 'N/A') {
			logger.debug('resolveEvidenceLinksForModerators: no evidence provided');
			return [];
		}
		const lines = String(rawEvidence)
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		const results = [];
		for (const url of lines) {
			logger.debug(`resolveEvidenceLinksForModerators: processing URL ${url}`);
			const match = url.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
			const messageId = match ? match[3] : null;
			if (!messageId) {
				logger.debug('resolveEvidenceLinksForModerators: no messageId parsed; adding jump URL only');
				results.push(url);
				continue;
			}
			if (!globalThis.reportEvidenceChannel) {
				logger.warn('resolveEvidenceLinksForModerators: reportEvidenceChannel not initialized; adding jump URL only');
				results.push(url);
				continue;
			}
			try {
				const message = await globalThis.reportEvidenceChannel.messages.fetch(messageId);
				const attachCount = message?.attachments?.size ?? 0;
				logger.debug(`resolveEvidenceLinksForModerators: message ${messageId} attachments=${attachCount}`);
				if (attachCount > 0) {
					for (const attachment of message.attachments.values()) {
						results.push(`${String(attachment.url)} (${url})`);
					}
				} else {
					results.push(url);
				}
			} catch (err) {
				logger.warn(`resolveEvidenceLinksForModerators: failed to fetch message ${messageId}: ${err}`);
				results.push(url);
			}
		}
		logger.debug(`resolveEvidenceLinksForModerators: completed with ${results.length} link line(s)`);
		return results;
	} catch (e) {
		logger.error('resolveEvidenceLinksForModerators: unexpected error', e);
		return [];
	}
}

function calculateCurrentPoints(warnings, asOf = Date.now()) {
	// 90 days in ms
	const PERIOD_MS = 90 * 24 * 60 * 60 * 1000;
	if (!Array.isArray(warnings) || warnings.length === 0) return 0;

	// Normalize: support either Warning instances or plain objects with similar fields
	const toTimestamp = (w) => {
		const ts = typeof w.getTimestamp === 'function' ? w.getTimestamp() : w.timestamp;
		return new Date(ts).getTime();
	};
	const toPoints = (w) => (typeof w.getPointsAdded === 'function' ? w.getPointsAdded() : w.points_added) || 0;

	// Sort warnings chronologically (oldest first)
	const sorted = [...warnings].sort((a, b) => toTimestamp(a) - toTimestamp(b));

	let points = 0;
	// start at first warning time
	let lastResetTime = toTimestamp(sorted[0]);

	// Process each warning: decay up to this warning’s timestamp, then reset timer and add points
	for (const w of sorted) {
		const ts = toTimestamp(w);

		// Apply decay that happened before this warning
		const elapsed = ts - lastResetTime;
		if (elapsed >= PERIOD_MS && points > 0) {
			const decays = Math.floor(elapsed / PERIOD_MS);
			points = Math.max(0, points - decays);
		}

		// Reset timer at this warning and add its points (zero-point warnings still reset)
		lastResetTime = ts;
		points += toPoints(w);
	}

	// Final decay from the last reset to the provided "asOf" moment
	let now;
	if (asOf instanceof Date) now = asOf.getTime();
	else if (typeof asOf === 'string') now = new Date(asOf).getTime();
	else if (typeof asOf === 'number') now = asOf;
	else now = Date.now();
	const elapsedFinal = now - lastResetTime;
	if (elapsedFinal >= PERIOD_MS && points > 0) {
		const decaysFinal = Math.floor(elapsedFinal / PERIOD_MS);
		points = Math.max(0, points - decaysFinal);
	}

	return points;
}

function getNextPointExpiry(warnings) {
	// 90 days in ms
	const PERIOD_MS = 90 * 24 * 60 * 60 * 1000;
	if (!Array.isArray(warnings) || warnings.length === 0) return null;

	// Normalize: support either Warning instances or plain objects with similar fields
	const toTimestamp = (w) => {
		const ts = typeof w.getTimestamp === 'function' ? w.getTimestamp() : w.timestamp;
		return new Date(ts).getTime();
	};
	const toPoints = (w) => (typeof w.getPointsAdded === 'function' ? w.getPointsAdded() : w.points_added) || 0;

	// Sort warnings chronologically (oldest first)
	const sorted = [...warnings].sort((a, b) => toTimestamp(a) - toTimestamp(b));

	let points = 0;
	// start at first warning time
	let lastResetTime = toTimestamp(sorted[0]);

	// Walk timeline: apply decay before each warning, then reset and add points
	for (const w of sorted) {
		const ts = toTimestamp(w);
		const elapsed = ts - lastResetTime;
		if (elapsed >= PERIOD_MS && points > 0) {
			const decays = Math.floor(elapsed / PERIOD_MS);
			points = Math.max(0, points - decays);
		}
		// reset timer at each warning (even zero-point)
		lastResetTime = ts;
		points += toPoints(w);
	}

	// Apply final decay up to now to get current points
	const now = Date.now();
	const elapsedFinal = now - lastResetTime;
	if (elapsedFinal >= PERIOD_MS && points > 0) {
		const decaysFinal = Math.floor(elapsedFinal / PERIOD_MS);
		points = Math.max(0, points - decaysFinal);
	}

	// If no points remain, there is no upcoming expiry
	if (points <= 0) return null;

	// Next expiry occurs at the next 90-day boundary after the last reset
	const periodsElapsed = Math.floor(elapsedFinal / PERIOD_MS);
	const nextExpiryTs = lastResetTime + (periodsElapsed + 1) * PERIOD_MS;

	return new Date(nextExpiryTs);
}

// Preserve newlines while chunking without breaking words (except ultra-long)
function chunkTextPreserveNewlines(text, max = 1024) {
	const chunks = [];
	let current = '';

	const lines = String(text).split(/\r?\n/);

	for (let li = 0; li < lines.length; li++) {
		const line = lines[li];

		// Handle completely empty line (just a newline)
		if (line === '') {
			// Add newline (if not last line)
			if (li < lines.length - 1) {
				if (current.length + 1 > max) {
					if (current) chunks.push(current);
					current = '';
				}
				current += '\n';
			}
			continue;
		}

		const words = line.split(/\s+/);

		for (let wi = 0; wi < words.length; wi++) {
			const word = words[wi];
			if (!word) continue;
			// space between words (not after newline or at start)
			const separatorNeeded = current.length && !current.endsWith('\n') && wi > 0 ? 1 : 0;

			const needed = current.length + separatorNeeded + word.length;

			if (needed > max) {
				if (current) chunks.push(current);
				current = '';
				// If word itself longer than max, hard-split
				if (word.length > max) {
					const pieces = word.match(new RegExp(`.{1,${max}}`, 'g'));
					while (pieces.length) {
						const piece = pieces.shift();
						if (piece.length === max) {
							chunks.push(piece);
						} else {
							current = piece;
							break;
						}
					}
					if (!current) current = '';
				} else {
					current = word;
				}
			} else {
				current += (separatorNeeded ? ' ' : '') + word;
			}
		}

		// Append newline if not last line
		if (li < lines.length - 1) {
			if (current.length + 1 > max) {
				if (current) chunks.push(current);
				current = '';
			}
			current += '\n';
		}
	}

	if (current) {
		// Remove trailing newline if it's the only character or at end
		if (current.endsWith('\n')) {
			// Keep intentional trailing newline if desired; usually safe to keep
		}
		chunks.push(current);
	}

	// Remove any empty chunks
	return chunks.filter((c) => c.length);
}

module.exports = {
	calculateCurrentPoints,
	getNextPointExpiry,
	chunkTextPreserveNewlines,
	resolveEvidenceLinks,
	resolveEvidenceLinksForUser,
	resolveEvidenceLinksForModerators,
};
/**
 * Determine which warnings contribute to the current point total at a given time.
 * Uses the same decay model as calculateCurrentPoints: 1 point decays every 90 days
 * since the last warning timestamp (timer resets at each warning, even zero-point ones).
 * Oldest points decay first.
 *
 * @param {Array} warnings Array of Warning instances or plain-like objects
 * @param {Date|string|number} asOf Timestamp to evaluate contributions at (default: now)
 * @returns {Array} Subset of input warnings that still contribute (chronological order)
 */
function getContributingWarnings(warnings, asOf = Date.now()) {
	const PERIOD_MS = 90 * 24 * 60 * 60 * 1000;
	if (!Array.isArray(warnings) || warnings.length === 0) return [];

	const toTimestamp = (w) => {
		const ts = typeof w.getTimestamp === 'function' ? w.getTimestamp() : w.timestamp;
		return new Date(ts).getTime();
	};
	const toPoints = (w) => (typeof w.getPointsAdded === 'function' ? w.getPointsAdded() : w.points_added) || 0;

	const sorted = [...warnings].sort((a, b) => toTimestamp(a) - toTimestamp(b));

	// Represent each point as a token tied to the warning index
	const tokens = [];
	let lastResetTime = toTimestamp(sorted[0]);

	const removeOldest = (n) => {
		if (n <= 0) return;
		const removeCount = Math.min(n, tokens.length);
		tokens.splice(0, removeCount);
	};

	for (let i = 0; i < sorted.length; i++) {
		const w = sorted[i];
		const ts = toTimestamp(w);
		const elapsed = ts - lastResetTime;
		if (elapsed >= PERIOD_MS && tokens.length > 0) {
			const decays = Math.floor(elapsed / PERIOD_MS);
			removeOldest(decays);
		}
		lastResetTime = ts;
		const pts = toPoints(w);
		for (let k = 0; k < pts; k++) {
			tokens.push({ idx: i, ts });
		}
	}

	let now;
	if (asOf instanceof Date) now = asOf.getTime();
	else if (typeof asOf === 'string') now = new Date(asOf).getTime();
	else if (typeof asOf === 'number') now = asOf;
	else now = Date.now();

	const elapsedFinal = now - lastResetTime;
	if (elapsedFinal >= PERIOD_MS && tokens.length > 0) {
		const decaysFinal = Math.floor(elapsedFinal / PERIOD_MS);
		removeOldest(decaysFinal);
	}

	const contributingIdx = Array.from(new Set(tokens.map((t) => t.idx))).sort((a, b) => a - b);
	return contributingIdx.map((i) => sorted[i]);
}

module.exports.getContributingWarnings = getContributingWarnings;
