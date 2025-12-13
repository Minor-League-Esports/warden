const log4js = require('log4js');
const logger = log4js.getLogger('UtilFunctions');
const { logLevel } = require('../config.json');
logger.level = logLevel;

function calculateCurrentPoints(warnings) {
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

	// Final decay from the last reset to "now"
	const now = Date.now();
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

module.exports = { calculateCurrentPoints, getNextPointExpiry, chunkTextPreserveNewlines };
