const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'stats.json');
const DEFAULT_STATE = { global: { songsPlayed: 0, msPlayed: 0}, guilds: {} };
const sessions = new Map();

let state = { ...DEFAULT_STATE };
let saveTimer = null;

async function init()
{
    try
    {
        const raw = await fs.readFile(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        state = {
            global: { ...DEFAULT_STATE.global, ...(parsed.global || {} )},
            guilds: { ...parsed.guilds },
        }
    }
    catch(error)
    {
        if(error.code !== 'ENOENT') throw error;

        await ensureDataDir();
        await persist();
    }
}

function ensureDataDir()
{
    return fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
}

function ensureGuild(guildId)
{
    if(!state.guilds[guildId])
    {
        state.guilds[guildId] = { songsPlayed: 0, msPlayed: 0, lastPlayedAt: null };
    }

    return state.guilds[guildId];
}

function scheduleSave()
{
    if(saveTimer) return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        await persist();
    }, 2000).unref?.();
}

async function persist()
{
    await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function beginTrackSession(guildId, track)
{
    const stats = ensureGuild(guildId);
    stats.songsPlayed += 1;
    stats.lastPlayedAt = new Date().toISOString();
    state.global.songsPlayed += 1;

    sessions.set(guildId, {
        startedAt: Date.now(),
        lastPosition: 0,
        trackLength: track.info.length ?? null,
    })

    scheduleSave();
}

function updateProgress(guildId, positionMs)
{
    const session = sessions.get(guildId);

    if(!session) return;

    session.lastPosition = Math.max(session.lastPosition, Number(positionMs) || 0);
}

function finishTrackSession(guildId, track, reason)
{
    const session = sessions.get(guildId);
    if(!session) return;

    if(['replaced', 'load_failed'].includes(reason))
    {
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

function abortSession(guildId)
{
    sessions.delete(guildId);
}

module.exports = {
    init,
    beginTrackSession,
    updateProgress,
    finishTrackSession,
    abortSession,
    getGuildStats: (guildId) => state.guilds[guildId] ?? null,
    getGlobalStats: () => state.global,
}