const log4js = require('log4js');
const logger = log4js.getLogger('UtilFunctions');
const { logLevel } = require('../config.json');
logger.level = logLevel;

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
		const results = [];
		for (const line of lines) {
			const match = line.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
			const messageId = match ? match[3] : null;
			const hasAnyUrl = /https?:\/\/\S+/.test(line);
			if (!messageId) {
				// Not a Discord message jump URL. Include the line as-is (plain text or other link).
				results.push(line);
				continue;
			}
			if (!globalThis.reportEvidenceChannel) {
				logger.warn('resolveEvidenceLinksForUser: evidence channel not initialized; skipping CDN resolution');
				// Do not include jump URLs for users; omit line if it's only a jump URL.
				// pure text safety
				if (!hasAnyUrl) results.push(line);
				continue;
			}
			try {
				const message = await globalThis.reportEvidenceChannel.messages.fetch(messageId);
				const attachCount = message?.attachments?.size ?? 0;
				if (attachCount > 0) {
					for (const attachment of message.attachments.values()) {
						results.push(String(attachment.url));
					}
				} else if (!hasAnyUrl) {
					// No attachments; do not include jump URL for users, but preserve plain text.
					results.push(line);
				}
			} catch (err) {
				logger.warn(`resolveEvidenceLinksForUser: failed to fetch message ${messageId}: ${err}`);
				// Do not include jump URLs for users; preserve plain text if any
				if (!hasAnyUrl) results.push(line);
			}
		}
		return results;
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
			return [];
		}
		const lines = String(rawEvidence)
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		const results = [];
		for (const line of lines) {
			const match = line.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
			const messageId = match ? match[3] : null;
			if (!messageId) {
				// Not a Discord message jump URL; include line as-is (plain text or other link)
				results.push(line);
				continue;
			}
			if (!globalThis.reportEvidenceChannel) {
				results.push(line);
				continue;
			}
			try {
				const message = await globalThis.reportEvidenceChannel.messages.fetch(messageId);
				const attachCount = message?.attachments?.size ?? 0;
				if (attachCount > 0) {
					for (const attachment of message.attachments.values()) {
						results.push(`${String(attachment.url)} (${line})`);
					}
				} else {
					results.push(line);
				}
			} catch (err) {
				logger.warn(`resolveEvidenceLinksForModerators: failed to fetch message ${messageId}: ${err}`);
				results.push(line);
			}
		}
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
	resolveEvidenceLinksForUser,
	resolveEvidenceLinksForModerators,
	notifyCaseThread,
	refreshReportMessage,
	acknowledgeReport,
	getCaseLinkById,
	buildWarnUserModal,
};

/**
 * Posts a message into a case's discussion thread, if the case exists and has a thread.
 * Threads created from a message share the message's ID, so the case's message ID doubles as its thread ID.
 *
 * @param {import('discord.js').Client} client
 * @param {String|null} caseId
 * @param {String} content
 */
async function notifyCaseThread(client, caseId, content) {
	if (!caseId) return;
	try {
		const kase = await globalThis.databaseManager.getCaseById(caseId);
		if (!kase.getCaseLink()) return;
		const threadId = kase.getCaseLink().split('/').pop();
		const thread = await client.channels.fetch(threadId);
		await thread.send(content);
	} catch (error) {
		logger.warn(`Failed to notify case thread for case ${caseId}: ${error}`);
	}
}

/**
 * Re-renders a report's moderator-facing embed on its original message (e.g. after it's attached to a case).
 *
 * @param {import('discord.js').Client} client
 * @param {Report} report
 * @param {String|null} caseLink Optional jump link to the case's discussion thread
 */
async function refreshReportMessage(client, report, caseLink = null) {
	if (!report.getReportLink()) return;
	try {
		const reportMessage = await globalThis.reportChannel.messages.fetch(report.getReportLink().split('/').pop());
		const embed = await report.generatePrivateEmbed(caseLink);
		await reportMessage.edit({ embeds: [embed] });
	} catch (error) {
		logger.warn(`Failed to refresh report message for report ${report.getReportId()}: ${error}`);
	}
}

/**
 * Marks a report as acknowledged and DMs the reporter to let them know moderators are on it.
 *
 * @param {import('discord.js').Client} client
 * @param {String} reportId
 * @returns {Promise<Report>} The updated Report
 */
async function acknowledgeReport(client, reportId) {
	const report = await globalThis.databaseManager.updateReport(reportId, {
		acknowledge_timestamp: new Date().toISOString(),
		status: 'ACKNOWLEDGED',
	});

	try {
		const reporter = await globalThis.databaseManager.getUserByIdentifier(report.getReporterId(), 'db');
		const reporterDiscordUser = await client.users.fetch(reporter.getDiscordId());
		await reporterDiscordUser.send({
			content: `Your report #${report.getReportId()} has been acknowledged. Moderators are now discussing it. Thank you for helping keep the community safe!`,
		});
	} catch (dmError) {
		logger.warn(`Could not DM reporter for report ${reportId}: ${dmError}`);
	}

	return report;
}

/**
 * Resolves the jump link to a case's discussion thread, if it has one.
 *
 * @param {String|null} caseId
 * @returns {Promise<String|null>}
 */
async function getCaseLinkById(caseId) {
	if (!caseId || caseId === 'N/A') return null;
	try {
		const kase = await globalThis.databaseManager.getCaseById(caseId);
		return kase.getCaseLink();
	} catch (error) {
		logger.warn(`Failed to resolve case link for case ${caseId}: ${error}`);
		return null;
	}
}

/**
 * Builds the "Issue Warning to User" modal, shared by the /warn flow and the case "Create Warning" button.
 *
 * @param {String} customId
 * @returns {import('discord.js').ModalBuilder}
 */
function buildWarnUserModal(customId) {
	// Lazily required to avoid a require cycle at module load time
	const { ModalBuilder, TextInputBuilder, LabelBuilder, TextInputStyle } = require('discord.js');

	const modal = new ModalBuilder().setCustomId(customId).setTitle('Issue Warning to User');

	const rulesBrokenInput = new TextInputBuilder()
		.setCustomId('rulesBroken')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('1.2(1) Mildly offensive language')
		.setRequired(true);
	const rulesBrokenInputLabel = new LabelBuilder().setLabel('Rule(s) Broken').setTextInputComponent(rulesBrokenInput);

	const violatingContentInput = new TextInputBuilder()
		.setCustomId('violatingContent')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Direct quote or description of the violating content (shown to user)')
		.setRequired(true);
	const violatingContentInputLabel = new LabelBuilder()
		.setLabel('Violating Content')
		.setTextInputComponent(violatingContentInput);

	const pointsAddedInput = new TextInputBuilder()
		.setCustomId('pointsAdded')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Number of points to add to user record')
		.setMinLength(1)
		.setMaxLength(2)
		.setRequired(true);
	const pointsAddedInputLabel = new LabelBuilder().setLabel('Points Added').setTextInputComponent(pointsAddedInput);

	const moderatorNotesInput = new TextInputBuilder()
		.setCustomId('moderatorNotes')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Additional notes from the moderator (not shown to user)')
		.setRequired(false);
	const moderatorNotesInputLabel = new LabelBuilder()
		.setLabel('Moderator Notes')
		.setTextInputComponent(moderatorNotesInput);

	modal.addLabelComponents(
		rulesBrokenInputLabel,
		violatingContentInputLabel,
		pointsAddedInputLabel,
		moderatorNotesInputLabel,
	);

	return modal;
}

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
