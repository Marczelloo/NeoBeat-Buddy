const fs = require("node:fs/promises");
const path = require("node:path");
const Log = require("../logs/log");
const { getTrackIdentity } = require("./trackIdentity");

const DATA_FILE = path.join(__dirname, "..", "data", "autoplayExposure.json");
const EXPOSURE_TTL_MS = Number(process.env.AUTOPLAY_EXPOSURE_TTL_MS ?? 14 * 24 * 60 * 60 * 1000);
const EXPOSURE_LIMIT = Number(process.env.AUTOPLAY_EXPOSURE_LIMIT ?? 300);
const TRANSITION_LIMIT = Math.max(EXPOSURE_LIMIT * 2, 600);
const WRITE_DELAY_MS = 1500;

const state = { guilds: {} };
let ready = false;
let initPromise = null;
let saveTimer = null;

function getExposureKey(trackLike) {
  const identity = getTrackIdentity(trackLike);
  if (identity.textKey) return identity.textKey;
  return identity.identifier ? `id:${identity.identifier}` : null;
}

function createGuildState() {
  return { tracks: {}, transitions: {} };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const lastSeen = Number(entry.lastSeen);
  const count = Number(entry.count);
  if (!Number.isFinite(lastSeen) || !Number.isFinite(count) || count <= 0) return null;

  return {
    lastSeen,
    count: Math.max(1, Math.floor(count)),
  };
}

function normalizeGuild(raw) {
  const guild = createGuildState();
  if (!raw || typeof raw !== "object") return guild;

  for (const [key, entry] of Object.entries(raw.tracks || {})) {
    const normalized = normalizeEntry(entry);
    if (normalized) guild.tracks[key] = normalized;
  }

  for (const [key, entry] of Object.entries(raw.transitions || {})) {
    const normalized = normalizeEntry(entry);
    if (normalized) guild.transitions[key] = normalized;
  }

  return guild;
}

function pruneGuild(guild, now = Date.now()) {
  const cutoff = now - Math.max(EXPOSURE_TTL_MS, 0);
  for (const [key, entry] of Object.entries(guild.tracks)) {
    if (EXPOSURE_TTL_MS > 0 && entry.lastSeen < cutoff) delete guild.tracks[key];
  }
  for (const [key, entry] of Object.entries(guild.transitions)) {
    if (EXPOSURE_TTL_MS > 0 && entry.lastSeen < cutoff) delete guild.transitions[key];
  }

  const entries = Object.entries(guild.tracks);
  if (EXPOSURE_LIMIT > 0 && entries.length > EXPOSURE_LIMIT) {
    entries
      .sort(([, left], [, right]) => right.lastSeen - left.lastSeen)
      .slice(EXPOSURE_LIMIT)
      .forEach(([key]) => delete guild.tracks[key]);
  }

  const transitions = Object.entries(guild.transitions);
  if (TRANSITION_LIMIT > 0 && transitions.length > TRANSITION_LIMIT) {
    transitions
      .sort(([, left], [, right]) => right.lastSeen - left.lastSeen)
      .slice(TRANSITION_LIMIT)
      .forEach(([key]) => delete guild.transitions[key]);
  }
}

async function persist() {
  if (!ready) return;
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function schedulePersist() {
  if (saveTimer) return;

  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await persist();
    } catch (error) {
      Log.error("Failed to persist autoplay exposure memory", error);
    }
  }, WRITE_DELAY_MS);
  saveTimer.unref?.();
}

async function init() {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const raw = await fs.readFile(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.guilds && typeof parsed.guilds === "object") {
        for (const [guildId, guild] of Object.entries(parsed.guilds)) {
          state.guilds[guildId] = normalizeGuild(guild);
          pruneGuild(state.guilds[guildId]);
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        Log.warning("Failed to load autoplay exposure memory", "", `error=${error.message}`);
      }
    }

    ready = true;
  })();

  return initPromise;
}

function getGuild(guildId) {
  if (!state.guilds[guildId]) state.guilds[guildId] = createGuildState();
  return state.guilds[guildId];
}

async function getAutoplayExposureSnapshot(guildId) {
  await init();
  const guild = getGuild(guildId);
  pruneGuild(guild);

  return {
    ttlMs: EXPOSURE_TTL_MS,
    tracks: Object.entries(guild.tracks).map(([key, entry]) => ({ key, ...entry })),
    transitions: Object.entries(guild.transitions).map(([key, entry]) => ({ key, ...entry })),
  };
}

async function recordAutoplayExposure(guildId, track, referenceTrack = null) {
  const trackKey = getExposureKey(track);
  if (!guildId || !trackKey) return false;

  await init();
  const now = Date.now();
  const guild = getGuild(guildId);
  const current = guild.tracks[trackKey] || { count: 0, lastSeen: now };
  current.count += 1;
  current.lastSeen = now;
  guild.tracks[trackKey] = current;

  const referenceKey = getExposureKey(referenceTrack);
  if (referenceKey && referenceKey !== trackKey) {
    const transitionKey = `${referenceKey}=>${trackKey}`;
    const transition = guild.transitions[transitionKey] || { count: 0, lastSeen: now };
    transition.count += 1;
    transition.lastSeen = now;
    guild.transitions[transitionKey] = transition;
  }

  pruneGuild(guild, now);
  schedulePersist();
  return true;
}

function getExposureRecord(snapshot, key, collection = "tracks") {
  if (!snapshot || !key) return null;
  return (snapshot[collection] || []).find((entry) => entry.key === key) || null;
}

function clearAutoplayExposureForTests() {
  state.guilds = {};
  ready = true;
  initPromise = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
}

module.exports = {
  DATA_FILE,
  EXPOSURE_TTL_MS,
  EXPOSURE_LIMIT,
  getExposureKey,
  getExposureRecord,
  getAutoplayExposureSnapshot,
  recordAutoplayExposure,
  clearAutoplayExposureForTests,
};
