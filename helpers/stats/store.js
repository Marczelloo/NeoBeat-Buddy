const fs = require("node:fs/promises");
const path = require("node:path");
const Log = require("../logs/log");

const DATA_FILE = path.join(__dirname, "..", "data", "stats.json");
const DEFAULT_GUILD_STATS = {
  songsPlayed: 0,
  msPlayed: 0,
  songsSkipped: 0,
  streamsPlayed: 0,
  playlistsAdded: 0,
  totalSessions: 0,
  peakListeners: 0,
  lastPlayedAt: null,
  firstPlayedAt: null,
  uniqueUsers: [],
  topSources: {},
  hourlyActivity: {},
};

const DEFAULT_USER_STATS = {
  songsPlayed: 0,
  msPlayed: 0,
  songsSkipped: 0,
  lastPlayedAt: null,
  firstPlayedAt: null,
  topSources: {},
  topTracks: {},
  topArtists: {},
  hourlyActivity: {},
  dailyActivity: {},
  monthlyActivity: {},
};

const DEFAULT_STATE = {
  global: { ...DEFAULT_GUILD_STATS },
  guilds: {},
  users: {},
};

const sessions = new Map();
let state = { ...DEFAULT_STATE };
let saveTimer = null;

async function init() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");

    if (!raw || raw.trim() === "") {
      await ensureDataDir();
      await persist();
      return;
    }

    const parsed = JSON.parse(raw);

    state = {
      global: {
        ...DEFAULT_GUILD_STATS,
        ...(parsed.global || {}),
      },
      guilds: parsed.guilds || {},
    };

    if (!state.global.topSources) state.global.topSources = {};
    if (!state.global.hourlyActivity) state.global.hourlyActivity = {};
    if (!Array.isArray(state.global.uniqueUsers)) state.global.uniqueUsers = [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      Log.error("Failed to load stats", error);
    }
    await ensureDataDir();
    await persist();
  }
}

function ensureDataDir() {
  return fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
}

function ensureGuild(guildId) {
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = { ...DEFAULT_GUILD_STATS };
  }

  const guild = state.guilds[guildId];
  if (!guild.topSources) guild.topSources = {};
  if (!guild.hourlyActivity) guild.hourlyActivity = {};
  if (!Array.isArray(guild.uniqueUsers)) guild.uniqueUsers = [];
  if (guild.peakListeners === undefined) guild.peakListeners = 0;
  if (guild.streamsPlayed === undefined) guild.streamsPlayed = 0;
  if (guild.playlistsAdded === undefined) guild.playlistsAdded = 0;
  if (guild.totalSessions === undefined) guild.totalSessions = 0;

  return guild;
}

function ensureUser(userId) {
  if (!state.users[userId]) {
    state.users[userId] = { ...DEFAULT_USER_STATS };
  }

  const user = state.users[userId];
  if (!user.topSources) user.topSources = {};
  if (!user.topTracks) user.topTracks = {};
  if (!user.topArtists) user.topArtists = {};
  if (!user.hourlyActivity) user.hourlyActivity = {};
  if (!user.dailyActivity) user.dailyActivity = {};
  if (!user.monthlyActivity) user.monthlyActivity = {};

  return user;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await persist();
    } catch (err) {
      Log.error("Failed to save stats", err);
    }
  }, 2000).unref?.();
}

async function persist() {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function incrementSource(stats, sourceName) {
  const source = sourceName || "unknown";
  stats.topSources[source] = (stats.topSources[source] || 0) + 1;
}

function updateHourlyActivity(stats) {
  const hour = new Date().getHours();
  stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;
}

function updateDailyActivity(stats) {
  const day = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  stats.dailyActivity[day] = (stats.dailyActivity[day] || 0) + 1;
}

function updateMonthlyActivity(stats) {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  stats.monthlyActivity[month] = (stats.monthlyActivity[month] || 0) + 1;
}

function incrementTrack(stats, track) {
  if (!track?.info?.title || !track?.info?.author) return;
  const key = `${track.info.author} - ${track.info.title}`;
  stats.topTracks[key] = (stats.topTracks[key] || 0) + 1;
}

function incrementArtist(stats, track) {
  if (!track?.info?.author) return;
  const artist = track.info.author;
  stats.topArtists[artist] = (stats.topArtists[artist] || 0) + 1;
}

function addUniqueUser(stats, userId) {
  if (!userId) return;
  if (!Array.isArray(stats.uniqueUsers)) {
    stats.uniqueUsers = [];
  }
  if (!stats.uniqueUsers.includes(userId)) {
    stats.uniqueUsers.push(userId);
  }
}

function beginTrackSession(guildId, track, voiceChannelSize = 0) {
  const stats = ensureGuild(guildId);
  const now = new Date().toISOString();

  stats.songsPlayed += 1;
  stats.lastPlayedAt = now;

  if (!stats.firstPlayedAt) {
    stats.firstPlayedAt = now;
  }

  if (track.info?.isStream) {
    stats.streamsPlayed += 1;
  }

  // Track source
  incrementSource(stats, track.info?.sourceName);

  // Track user
  addUniqueUser(stats, track.info?.requesterId);

  // Track hourly activity
  updateHourlyActivity(stats);

  // Track peak listeners
  if (voiceChannelSize > stats.peakListeners) {
    stats.peakListeners = voiceChannelSize;
  }

  // Global stats
  state.global.songsPlayed += 1;
  if (track.info?.isStream) {
    state.global.streamsPlayed += 1;
  }
  incrementSource(state.global, track.info?.sourceName);
  addUniqueUser(state.global, track.info?.requesterId);
  updateHourlyActivity(state.global);

  // User stats
  if (track.info?.requesterId) {
    const userStats = ensureUser(track.info.requesterId);
    userStats.songsPlayed += 1;
    userStats.lastPlayedAt = now;

    if (!userStats.firstPlayedAt) {
      userStats.firstPlayedAt = now;
    }

    incrementSource(userStats, track.info?.sourceName);
    incrementTrack(userStats, track);
    incrementArtist(userStats, track);
    updateHourlyActivity(userStats);
    updateDailyActivity(userStats);
    updateMonthlyActivity(userStats);
  }

  sessions.set(guildId, {
    startedAt: Date.now(),
    lastPositionMs: 0,
    trackLength: track.info?.length ?? null,
    userId: track.info?.requesterId,
  });

  scheduleSave();
}

function trackPlaylistAdded(guildId) {
  const stats = ensureGuild(guildId);
  stats.playlistsAdded += 1;
  state.global.playlistsAdded += 1;
  scheduleSave();
}

function trackSkip(guildId) {
  const stats = ensureGuild(guildId);
  stats.songsSkipped += 1;
  state.global.songsSkipped += 1;

  // Track user skip if session exists
  const session = sessions.get(guildId);
  if (session?.userId) {
    const userStats = ensureUser(session.userId);
    userStats.songsSkipped = (userStats.songsSkipped || 0) + 1;
  }

  scheduleSave();
}

function updateProgress(guildId, positionMs) {
  const session = sessions.get(guildId);
  if (!session) return;
  session.lastPositionMs = Math.max(session.lastPositionMs, Number(positionMs) || 0);
}

function finishTrackSession(guildId, track, reason) {
  const session = sessions.get(guildId);
  if (!session) return;

  if (["replaced", "load_failed"].includes(reason)) {
    sessions.delete(guildId);
    return;
  }

  const length = session.trackLength ?? track?.info?.length ?? session.lastPositionMs;
  const played = Math.min(length, session.lastPositionMs);
  const safePlay = Number.isFinite(played) ? Math.max(0, played) : 0;

  const stats = ensureGuild(guildId);
  stats.msPlayed += safePlay;
  state.global.msPlayed += safePlay;

  // User stats
  if (session.userId) {
    const userStats = ensureUser(session.userId);
    userStats.msPlayed += safePlay;
  }

  sessions.delete(guildId);
  scheduleSave();
}

function beginSession(guildId) {
  const stats = ensureGuild(guildId);
  stats.totalSessions += 1;
  state.global.totalSessions += 1;
  scheduleSave();
}

function abortSession(guildId) {
  sessions.delete(guildId);
}

function getGuildStats(guildId) {
  const stats = state.guilds[guildId];
  if (!stats) return null;

  return {
    ...stats,
    averageSessionLength: stats.totalSessions > 0 ? Math.round(stats.msPlayed / stats.totalSessions) : 0,
    uniqueUserCount: stats.uniqueUsers?.length || 0,
  };
}

function getGlobalStats() {
  return {
    ...state.global,
    averageSessionLength:
      state.global.totalSessions > 0 ? Math.round(state.global.msPlayed / state.global.totalSessions) : 0,
    uniqueUserCount: state.global.uniqueUsers?.length || 0,
  };
}

function getTopSources(guildId, limit = 5) {
  const stats = guildId ? state.guilds[guildId] : state.global;
  if (!stats?.topSources) return [];

  return Object.entries(stats.topSources)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([source, count]) => ({ source, count }));
}

function getMostActiveHour(guildId) {
  const stats = guildId ? state.guilds[guildId] : state.global;
  if (!stats?.hourlyActivity) return null;

  const entries = Object.entries(stats.hourlyActivity);
  if (entries.length === 0) return null;

  const [hour, count] = entries.reduce((max, current) => (current[1] > max[1] ? current : max));

  return { hour: parseInt(hour), count };
}

function getUserStats(userId) {
  const stats = state.users[userId];
  if (!stats) return null;

  return { ...stats };
}

function getTopTracks(userId, limit = 10) {
  const stats = state.users[userId];
  if (!stats?.topTracks) return [];

  return Object.entries(stats.topTracks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([track, count]) => ({ track, count }));
}

function getTopArtists(userId, limit = 10) {
  const stats = state.users[userId];
  if (!stats?.topArtists) return [];

  return Object.entries(stats.topArtists)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([artist, count]) => ({ artist, count }));
}

function getUserMostActiveHour(userId) {
  const stats = state.users[userId];
  if (!stats?.hourlyActivity) return null;

  const entries = Object.entries(stats.hourlyActivity);
  if (entries.length === 0) return null;

  const [hour, count] = entries.reduce((max, current) => (current[1] > max[1] ? current : max));

  return { hour: parseInt(hour), count };
}

function getRecentActivity(userId, days = 30) {
  const stats = state.users[userId];
  if (!stats?.dailyActivity) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  return Object.entries(stats.dailyActivity)
    .filter(([date]) => date >= cutoffStr)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, count]) => ({ date, count }));
}

function getListeningStreak(userId) {
  const stats = state.users[userId];
  if (!stats?.dailyActivity) return { current: 0, longest: 0 };

  const dates = Object.keys(stats.dailyActivity).sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return { current: 0, longest: 0 };

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Check current streak
  if (dates[0] === today || dates[0] === yesterdayStr) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 1;
      }
    }
  }

  // Calculate longest streak
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
    } else {
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      tempStreak = 1;
    }
  }

  if (tempStreak > longestStreak) longestStreak = tempStreak;

  return { current: currentStreak, longest: longestStreak };
}

module.exports = {
  init,
  beginTrackSession,
  beginSession,
  trackPlaylistAdded,
  trackSkip,
  updateProgress,
  finishTrackSession,
  abortSession,
  getGuildStats,
  getGlobalStats,
  getTopSources,
  getMostActiveHour,
  getUserStats,
  getTopTracks,
  getTopArtists,
  getUserMostActiveHour,
  getRecentActivity,
  getListeningStreak,
};
