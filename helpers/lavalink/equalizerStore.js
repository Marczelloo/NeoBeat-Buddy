const fs = require("node:fs/promises");
const path = require("node:path");
const Log = require("../logs/log");

const DATA_FILE = path.join(__dirname, "..", "data", "equalizer.json");
const equalizerState = new Map();

async function init() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");

    if (!raw || raw.trim() === "") {
      Log.info("Equalizer state file is empty, initializing with defaults");
      await persist();
      return;
    }

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      for (const [guildId, filters] of Object.entries(parsed)) {
        if (filters && typeof filters === "object") {
          equalizerState.set(guildId, filters);
        }
      }
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await persist();
    } else if (err instanceof SyntaxError) {
      Log.warning("Equalizer state file corrupted, resetting");
      await persist();
    } else {
      Log.error("Failed to load equalizer state", err);
    }
  }
}

let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      const data = Object.fromEntries(equalizerState);
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      Log.error("Failed to save equalizer state", err);
    }
  }, 2000).unref?.();
}

async function persist() {
  try {
    const data = Object.fromEntries(equalizerState);
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    Log.error("Failed to persist equalizer state", err);
  }
}

function getEqualizerState(guildId) {
  return equalizerState.get(guildId) ?? null;
}

function setEqualizerState(guildId, filters) {
  if (!guildId) return;

  if (filters && typeof filters === "object") {
    equalizerState.set(guildId, filters);
  } else {
    equalizerState.delete(guildId);
  }

  scheduleSave();
}

function clearEqualizerState(guildId) {
  if (!guildId) return;
  equalizerState.delete(guildId);
  scheduleSave();
}

module.exports = {
  init,
  getEqualizerState,
  setEqualizerState,
  clearEqualizerState,
  equalizerState,
};
