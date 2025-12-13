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

module.exports = { calculateCurrentPoints, getNextPointExpiry };
