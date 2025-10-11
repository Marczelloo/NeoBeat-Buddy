const fs = require("node:fs/promises");
const path = require("node:path");
const Log = require("./logs/log");

const DATA_FILE = path.join(__dirname, "data", "guildState.json");
const guildState = new Map();

async function init() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");

    if (!raw || raw.trim() === "") {
      Log.info("Guild state file is empty, initializing with defaults");
      await persist();
      return;
    }

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      for (const [guildId, state] of Object.entries(parsed)) {
        guildState.set(guildId, state);
      }
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await persist();
    } else if (err instanceof SyntaxError) {
      Log.warning("Guild state file corrupted, resetting");
      await persist();
    } else {
      Log.error("Failed to load guild state", err);
    }
  }
}

let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      const data = Object.fromEntries(guildState);
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      Log.error("Failed to save guild state", err);
    }
  }, 2000).unref?.();
}

async function persist() {
  try {
    const data = Object.fromEntries(guildState);
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    Log.error("Failed to persist guild state", err);
  }
}

const createDefaultState = () => ({
  nowPlayingMessage: null,
  nowPlayingChannel: null,
  autoplay: false,
});

function getGuildState(guildId) {
  if (!guildId) {
    Log.error("getGuildState called without a guildId");
    return null;
  }

  if (!guildState.has(guildId)) {
    guildState.set(guildId, createDefaultState());
  }

  return guildState.get(guildId);
}

function updateGuildState(guildId, partial = {}) {
  const state = getGuildState(guildId);
  Object.assign(state, partial);
  scheduleSave();
  return state;
}

function resetGuildState(guildId) {
  if (!guildId) return;
  guildState.set(guildId, createDefaultState());
  scheduleSave();
}

module.exports = {
  init,
  getGuildState,
  updateGuildState,
  resetGuildState,
};
