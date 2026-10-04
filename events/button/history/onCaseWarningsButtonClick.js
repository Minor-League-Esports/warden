const { showCasePage } = require('./caseHistoryPager');

async function handleCaseWarningsButtonClick(interaction) {
	const [, caseId] = interaction.customId.split(':');
	await interaction.deferReply();
	await showCasePage(interaction, 'warnings', caseId, 0, false);
}

module.exports = {
	handleCaseWarningsButtonClick,
};
