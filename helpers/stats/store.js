const fs = require('node:fs/promises');
const path = require('node:path');
const Log = require('../logs/log');

const DATA_FILE = path.join(__dirname, '..', 'data', 'stats.json');
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

const DEFAULT_STATE = { 
    global: { ...DEFAULT_GUILD_STATS }, 
    guilds: {} 
};

const sessions = new Map();
let state = { ...DEFAULT_STATE };
let saveTimer = null;

async function init() {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf-8');

        if(!raw || raw.trim() === '') 
        {
            await ensureDataDir();
            await persist();
            return;
        }

        const parsed = JSON.parse(raw);

        state = {
            global: { 
                ...DEFAULT_GUILD_STATS, 
                ...(parsed.global || {}) 
            },
            guilds: parsed.guilds || {},
        };

        if (!state.global.topSources) state.global.topSources = {};
        if (!state.global.hourlyActivity) state.global.hourlyActivity = {};
        if (!Array.isArray(state.global.uniqueUsers)) state.global.uniqueUsers = [];

    } catch (error) {
        if (error.code !== 'ENOENT') {
            Log.error('Failed to load stats', error);
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

function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        try {
            await persist();
        } catch (err) {
            Log.error('Failed to save stats', err);
        }
    }, 2000).unref?.();
}

async function persist() {
    await ensureDataDir();
    await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function incrementSource(stats, sourceName) {
    const source = sourceName || 'unknown';
    stats.topSources[source] = (stats.topSources[source] || 0) + 1;
}

function updateHourlyActivity(stats) {
    const hour = new Date().getHours();
    stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;
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

    sessions.set(guildId, {
        startedAt: Date.now(),
        lastPositionMs: 0,
        trackLength: track.info?.length ?? null,
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

    if (['replaced', 'load_failed'].includes(reason)) {
        sessions.delete(guildId);
        return;
    }

    const length = session.trackLength ?? track?.info?.length ?? session.lastPositionMs;
    const played = Math.min(length, session.lastPositionMs);
    const safePlay = Number.isFinite(played) ? Math.max(0, played) : 0;

    const stats = ensureGuild(guildId);
    stats.msPlayed += safePlay;
    state.global.msPlayed += safePlay;

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
        averageSessionLength: stats.totalSessions > 0 
            ? Math.round(stats.msPlayed / stats.totalSessions)
            : 0,
        uniqueUserCount: stats.uniqueUsers?.length || 0,
    };
}

function getGlobalStats() {
    return {
        ...state.global,
        averageSessionLength: state.global.totalSessions > 0
            ? Math.round(state.global.msPlayed / state.global.totalSessions)
            : 0,
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
    
    const [hour, count] = entries.reduce((max, current) => 
        current[1] > max[1] ? current : max
    );
    
    return { hour: parseInt(hour), count };
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
};