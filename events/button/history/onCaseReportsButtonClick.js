const { showCasePage } = require('./caseHistoryPager');

async function handleCaseReportsButtonClick(interaction) {
	const [, caseId] = interaction.customId.split(':');
	await interaction.deferReply();
	await showCasePage(interaction, 'reports', caseId, 0, false);
}

module.exports = {
	handleCaseReportsButtonClick,
};
