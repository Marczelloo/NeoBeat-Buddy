const fs = require("node:fs/promises");
const path = require("node:path");
const { backupCorruptFile, writeJsonAtomic } = require("../data/atomicJson");
const Log = require("../logs/log");

const DATA_FILE = path.join(__dirname, "../data/userPreferences.json");

// In-memory cache
let preferences = {};

async function init() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    preferences = JSON.parse(raw);
    Log.info("✅ User preferences loaded");
  } catch (err) {
    if (err.code === "ENOENT") {
      preferences = {};
      await save();
    } else if (err instanceof SyntaxError) {
      const backupPath = await backupCorruptFile(DATA_FILE).catch(() => null);
      Log.warning(`User preferences file corrupted and preserved at ${backupPath || "an unavailable backup path"}`);
      preferences = {};
      await save();
    } else {
      Log.error("Failed to load user preferences", err);
      preferences = {};
    }
  }
}

async function save() {
  try {
    await writeJsonAtomic(DATA_FILE, preferences);
  } catch (err) {
    Log.error("Failed to save user preferences", err);
  }
}

// Debounced save
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 2000);
}

function getUserPreferences(userId) {
  if (!preferences[userId]) {
    preferences[userId] = {
      defaultSource: null, // null means use server default
    };
  }
  return preferences[userId];
}

function setUserPreference(userId, key, value) {
  if (!preferences[userId]) {
    preferences[userId] = {};
  }
  preferences[userId][key] = value;
  scheduleSave();
  return preferences[userId];
}

function getUserDefaultSource(userId) {
  return preferences[userId]?.defaultSource || null;
}

function setUserDefaultSource(userId, source) {
  return setUserPreference(userId, "defaultSource", source);
}

async function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await save();
}

module.exports = {
  init,
  getUserPreferences,
  setUserPreference,
  getUserDefaultSource,
  setUserDefaultSource,
  flush,
};
