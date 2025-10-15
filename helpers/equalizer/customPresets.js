const fs = require("fs");
const path = require("path");
const Log = require("../logs/log");

const CUSTOM_PRESETS_FILE = path.join(__dirname, "../data/customPresets.json");

let customPresets = new Map();

function loadCustomPresets() {
  try {
    if (fs.existsSync(CUSTOM_PRESETS_FILE)) {
      const data = fs.readFileSync(CUSTOM_PRESETS_FILE, "utf8");
      const parsed = JSON.parse(data);

      customPresets = new Map(Object.entries(parsed));
      Log.success("Custom EQ presets loaded", "", `count=${customPresets.size}`);
    }
  } catch (err) {
    Log.error("Failed to load custom presets", err);
    customPresets = new Map();
  }
}

function saveCustomPresets() {
  try {
    const obj = {};
    for (const [userId, presets] of customPresets.entries()) {
      obj[String(userId)] = presets;
    }
    fs.writeFileSync(CUSTOM_PRESETS_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) {
    Log.error("Failed to save custom presets", err);
  }
}

function getUserPresets(userId) {
  return customPresets.get(String(userId)) || {};
}

function saveUserPreset(userId, presetName, bands) {
  const userIdStr = String(userId);
  const userPresets = getUserPresets(userIdStr);

  const presetKeys = Object.keys(userPresets);
  if (!userPresets[presetName] && presetKeys.length >= 10) {
    return { success: false, error: "Maximum 10 custom presets allowed. Delete one first." };
  }

  userPresets[presetName] = {
    name: presetName,
    bands: bands,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  customPresets.set(userIdStr, userPresets);
  saveCustomPresets();

  return { success: true };
}

function deleteUserPreset(userId, presetName) {
  const userIdStr = String(userId);
  const userPresets = getUserPresets(userIdStr);

  if (!userPresets[presetName]) {
    return { success: false, error: "Preset not found" };
  }

  delete userPresets[presetName];
  customPresets.set(userIdStr, userPresets);
  saveCustomPresets();

  return { success: true };
}

function getUserPresetNames(userId) {
  const userPresets = getUserPresets(String(userId));
  return Object.keys(userPresets);
}

function loadUserPreset(userId, presetName) {
  const userPresets = getUserPresets(String(userId));
  return userPresets[presetName] || null;
}

loadCustomPresets();

module.exports = {
  getUserPresets,
  saveUserPreset,
  deleteUserPreset,
  getUserPresetNames,
  loadUserPreset,
  loadCustomPresets,
};
