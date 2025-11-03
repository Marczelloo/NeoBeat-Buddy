const { SlashCommandBuilder } = require("discord.js");
const { statsEmbed } = require("../../helpers/embeds");
const statsStore = require("../../helpers/stats/store");

const formatLastActivity = (iso) => {
  if (!iso) return "No activity recorded";
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "No tracks played yet.";

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show music playback statistics")
    .addBooleanOption((option) =>
      option.setName("detailed").setDescription("Show detailed stats with top sources and activity").setRequired(false)
    ),
  async execute(interaction) {
    const detailed = interaction.options.getBoolean("detailed") || false;

    const guildStats = statsStore.getGuildStats(interaction.guildId) ?? { songsPlayed: 0, msPlayed: 0 };
    const globalStats = statsStore.getGlobalStats();
    const lastActivityLabel = formatLastActivity(guildStats.lastPlayedAt);

    if (detailed) {
      const topSources = statsStore.getTopSources(interaction.guildId, 5);
      const mostActiveHour = statsStore.getMostActiveHour(interaction.guildId);

      await interaction.reply({
        embeds: [
          statsEmbed(guildStats, globalStats, lastActivityLabel, {
            topSources,
            mostActiveHour,
          }),
        ],
      });
    } else {
      await interaction.reply({ embeds: [statsEmbed(guildStats, globalStats, lastActivityLabel)] });
    }
  },
};
