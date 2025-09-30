const { SlashCommandBuilder } = require('discord.js');
const { statsEmbed } = require('../../helpers/embeds');
const statsStore = require('../../helpers/stats/store');

const formatLastActivity = (iso) => {
    if(!iso) return 'No activity recorded';
    const date = new Date(iso);

    if(Number.isNaN(date.getTime())) return 'No tracks played yet.';

    return new Intl.DateTimeFormat('pl-PL', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show music playback statistics'),
  async execute(interaction) {
    const guildStats = statsStore.getGuildStats(interaction.guildId) ?? { songsPlayed: 0, msPlayed: 0 };
    const globalStats = statsStore.getGlobalStats();
    const lastActivityLabel = formatLastActivity(guildStats.lastPlayedAt);

    await interaction.reply({ embeds: [statsEmbed(
        guildStats,
        globalStats,
        lastActivityLabel
    )]});
  },
};
