const log4js = require('log4js');
const logger = log4js.getLogger('RemoteManager');
const { logLevel } = require('../config.json');
logger.level = logLevel;

const https = require('https');
const fs = require('node:fs');
const path = require('node:path');

class RemoteManager {
	async fetch(url) {
		// Local file mode: if not http/https, treat as filesystem path
		if (!/^https?:\/\//i.test(url)) {
			return new Promise((resolve, reject) => {
				fs.readFile(path.resolve(url), 'utf8', (err, data) => {
					if (err) {
						logger.error(`Error reading local file \`${url}\`\n\`\`\`\n${err}\n\`\`\``);
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
		}

		return new Promise((resolve, reject) => {
			https.get(url, (response) => {
				let content = '';
				response.on('data', (chunk) => {
					content += chunk;
				});
				response.on('end', () => {
					resolve(content);
				});
				response.on('error', (error) => {
					logger.error(`There was an error reading remote URL \`${url}\`\n\`\`\`\n${error}\n\`\`\``);
					reject(error);
				});
			});
		});
	}
}

module.exports = {
	RemoteManager,
};
