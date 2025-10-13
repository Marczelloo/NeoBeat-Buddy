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
      // Convert Map to object with string keys to avoid BigInt serialization issues
      const data = {};
      for (const [guildId, filters] of equalizerState.entries()) {
        data[String(guildId)] = filters;
      }
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      Log.error("Failed to save equalizer state", err);
    }
  }, 2000).unref?.();
}

async function persist() {
  try {
    // Convert Map to object with string keys to avoid BigInt serialization issues
    const data = {};
    for (const [guildId, filters] of equalizerState.entries()) {
      data[String(guildId)] = filters;
    }
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    Log.error("Failed to persist equalizer state", err);
  }
}

function getEqualizerState(guildId) {
  return equalizerState.get(String(guildId)) ?? null;
}

function setEqualizerState(guildId, filters) {
  if (!guildId) return;

  // Ensure guildId is stored as string
  const guildIdStr = String(guildId);

  if (filters && typeof filters === "object") {
    equalizerState.set(guildIdStr, filters);
  } else {
    equalizerState.delete(guildIdStr);
  }

  scheduleSave();
}

function clearEqualizerState(guildId) {
  if (!guildId) return;
  equalizerState.delete(String(guildId));
  scheduleSave();
}

module.exports = {
  init,
  getEqualizerState,
  setEqualizerState,
  clearEqualizerState,
  equalizerState,
};
