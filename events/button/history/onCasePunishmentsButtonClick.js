const { showCasePage } = require('./caseHistoryPager');

async function handleCasePunishmentsButtonClick(interaction) {
	const [, caseId] = interaction.customId.split(':');
	await interaction.deferReply();
	await showCasePage(interaction, 'punishments', caseId, 0, false);
}

module.exports = {
	handleCasePunishmentsButtonClick,
};
