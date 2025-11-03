const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const statsStore = require("../../helpers/stats/store");

const COLORS = {
  wrapped: 0x1db954, // Spotify green
  insights: 0xff006e,
};

const ICONS = {
  wrapped: "🎁",
  music: "🎵",
  time: "⏱️",
  fire: "🔥",
  star: "⭐",
  chart: "📊",
  artist: "👤",
  source: "📻",
  calendar: "📅",
};

const formatDuration = (ms) => {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const getActivityLevel = (songsPlayed) => {
  if (songsPlayed >= 1000) return "Legendary Listener 🏆";
  if (songsPlayed >= 500) return "Music Enthusiast 🎸";
  if (songsPlayed >= 250) return "Active Listener 🎧";
  if (songsPlayed >= 100) return "Regular User 🎵";
  if (songsPlayed >= 50) return "Casual Listener 🎶";
  return "Getting Started 🌱";
};

function createUserWrappedEmbed(userId, user, userStats) {
  if (!userStats) {
    return new EmbedBuilder()
      .setTitle(`${ICONS.wrapped} Your Music Wrapped`)
      .setDescription("You haven't listened to any music yet! Start playing to build your stats.")
      .setColor(COLORS.wrapped)
      .setTimestamp();
  }

  const topTracks = statsStore.getTopTracks(userId, 5);
  const topArtists = statsStore.getTopArtists(userId, 5);
  const topSources = Object.entries(userStats.topSources || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  const mostActiveHour = statsStore.getUserMostActiveHour(userId);
  const streak = statsStore.getListeningStreak(userId);

  const embed = new EmbedBuilder()
    .setTitle(`${ICONS.wrapped} ${user.displayName}'s Music Wrapped`)
    .setColor(COLORS.wrapped)
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  // Overview
  const totalHours = (userStats.msPlayed / 3_600_000).toFixed(1);
  const totalDays = (userStats.msPlayed / 86_400_000).toFixed(2);
  const avgPerDay =
    userStats.dailyActivity && Object.keys(userStats.dailyActivity).length > 0
      ? Math.round(userStats.songsPlayed / Object.keys(userStats.dailyActivity).length)
      : 0;

  embed.addFields({
    name: `${ICONS.chart} Overview`,
    value: [
      `**${userStats.songsPlayed}** songs played`,
      `**${totalHours}h** (${totalDays} days) of music`,
      `**${avgPerDay}** avg songs per day`,
      `Level: **${getActivityLevel(userStats.songsPlayed)}**`,
    ].join("\n"),
    inline: false,
  });

  // Top Tracks
  if (topTracks.length > 0) {
    const trackList = topTracks.map((item, i) => `${i + 1}. **${item.track}** (${item.count}× played)`).join("\n");

    embed.addFields({
      name: `${ICONS.music} Top Tracks`,
      value: trackList,
      inline: false,
    });
  }

  // Top Artists
  if (topArtists.length > 0) {
    const artistList = topArtists.map((item, i) => `${i + 1}. **${item.artist}** (${item.count} songs)`).join("\n");

    embed.addFields({
      name: `${ICONS.artist} Top Artists`,
      value: artistList,
      inline: false,
    });
  }

  // Listening Patterns
  const patterns = [];

  if (mostActiveHour) {
    const hourStr = `${mostActiveHour.hour}:00`;
    patterns.push(`${ICONS.time} Most active: **${hourStr}** (${mostActiveHour.count} songs)`);
  }

  if (topSources.length > 0) {
    const [topSource] = topSources[0];
    patterns.push(`${ICONS.source} Favorite source: **${topSource}**`);
  }

  if (streak.current > 0) {
    patterns.push(`${ICONS.fire} Current streak: **${streak.current}** days`);
  }

  if (streak.longest > 1) {
    patterns.push(`${ICONS.star} Longest streak: **${streak.longest}** days`);
  }

  if (patterns.length > 0) {
    embed.addFields({
      name: `${ICONS.calendar} Listening Patterns`,
      value: patterns.join("\n"),
      inline: false,
    });
  }

  // Footer
  const memberSince = formatTimeAgo(userStats.firstPlayedAt);
  embed.setFooter({ text: `Member since ${memberSince} • Last active ${formatTimeAgo(userStats.lastPlayedAt)}` });

  return embed;
}

function createServerWrappedEmbed(interaction, guildStats) {
  if (!guildStats) {
    return new EmbedBuilder()
      .setTitle(`${ICONS.wrapped} Server Music Wrapped`)
      .setDescription("No music has been played in this server yet!")
      .setColor(COLORS.wrapped)
      .setTimestamp();
  }

  const topSources = statsStore.getTopSources(interaction.guildId, 5);
  const mostActiveHour = statsStore.getMostActiveHour(interaction.guildId);

  const embed = new EmbedBuilder()
    .setTitle(`${ICONS.wrapped} ${interaction.guild.name} Music Wrapped`)
    .setColor(COLORS.wrapped)
    .setThumbnail(interaction.guild.iconURL())
    .setTimestamp();

  // Overview
  const totalHours = (guildStats.msPlayed / 3_600_000).toFixed(1);
  const totalDays = (guildStats.msPlayed / 86_400_000).toFixed(2);
  const avgSongsPerSession =
    guildStats.totalSessions > 0 ? Math.round(guildStats.songsPlayed / guildStats.totalSessions) : 0;

  embed.addFields({
    name: `${ICONS.chart} Server Overview`,
    value: [
      `**${guildStats.songsPlayed}** songs played`,
      `**${totalHours}h** (${totalDays} days) total`,
      `**${guildStats.totalSessions}** listening sessions`,
      `**${avgSongsPerSession}** avg songs per session`,
    ].join("\n"),
    inline: false,
  });

  // Community Stats
  embed.addFields({
    name: `${ICONS.star} Community Stats`,
    value: [
      `**${guildStats.uniqueUserCount}** unique listeners`,
      `**${guildStats.peakListeners}** peak listeners`,
      `**${guildStats.songsSkipped}** songs skipped`,
      `**${guildStats.playlistsAdded}** playlists added`,
    ].join("\n"),
    inline: false,
  });

  // Top Sources
  if (topSources.length > 0) {
    const sourceList = topSources
      .map((item, i) => {
        const percentage = ((item.count / guildStats.songsPlayed) * 100).toFixed(1);
        return `${i + 1}. **${item.source}** - ${item.count} songs (${percentage}%)`;
      })
      .join("\n");

    embed.addFields({
      name: `${ICONS.source} Top Sources`,
      value: sourceList,
      inline: false,
    });
  }

  // Activity Pattern
  if (mostActiveHour) {
    const hourStr = `${mostActiveHour.hour}:00`;
    embed.addFields({
      name: `${ICONS.time} Peak Activity`,
      value: `Most active hour: **${hourStr}** (${mostActiveHour.count} songs)`,
      inline: false,
    });
  }

  // Footer
  const memberSince = formatTimeAgo(guildStats.firstPlayedAt);
  embed.setFooter({ text: `Music playing since ${memberSince}` });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wrapped")
    .setDescription("View your music listening wrapped & insights")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("me")
        .setDescription("View your personal music wrapped")
        .addUserOption((option) => option.setName("user").setDescription("View another user's wrapped (optional)"))
    )
    .addSubcommand((subcommand) => subcommand.setName("server").setDescription("View this server's music wrapped")),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "me") {
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const userStats = statsStore.getUserStats(targetUser.id);

      const embed = createUserWrappedEmbed(targetUser.id, targetUser, userStats);
      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === "server") {
      const guildStats = statsStore.getGuildStats(interaction.guildId);
      const embed = createServerWrappedEmbed(interaction, guildStats);
      await interaction.reply({ embeds: [embed] });
    }
  },
};
