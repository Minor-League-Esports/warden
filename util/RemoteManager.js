const https = require('https');
const fs = require('node:fs');
const path = require('node:path');

class RemoteManager {
	constructor(logger) {
		this._logger = logger;
	}

	async fetch(url) {
		// Local file mode: if not http/https, treat as filesystem path
		if (!/^https?:\/\//i.test(url)) {
			return new Promise((resolve, reject) => {
				fs.readFile(path.resolve(url), 'utf8', (err, data) => {
					if (err) {
						this._logger.logMessage(
							`Error reading local file \`${url}\`\n\`\`\`\n${err}\n\`\`\``,
						);
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
					this._logger.logMessage(
						`There was an error reading remote URL \`${url}\`\n\`\`\`\n${error}\n\`\`\``,
					);
					reject(error);
				});
			});
		});
	}
}

module.exports = {
	RemoteManager,
};
