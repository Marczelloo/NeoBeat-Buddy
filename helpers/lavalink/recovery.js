const fs = require("node:fs/promises");
const path = require("node:path");
const Log = require("../logs/log");
const { cloneTrack, playbackState } = require("./state");

const DATA_FILE = path.join(__dirname, "..", "data", "playerRecovery.json");
const RECOVERY_MAX_AGE_MS = Number(process.env.PLAYER_RECOVERY_MAX_AGE_MS ?? 2 * 60 * 60 * 1000);
const snapshots = new Map();
let loaded = false;
let writeTimer = null;

function isFreshSnapshot(snapshot, now = Date.now()) {
  return Boolean(snapshot?.savedAt && now - snapshot.savedAt >= 0 && now - snapshot.savedAt <= RECOVERY_MAX_AGE_MS);
}

async function loadSnapshots() {
  if (loaded) return;
  loaded = true;
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    for (const [guildId, snapshot] of Object.entries(parsed || {})) {
      if (isFreshSnapshot(snapshot)) snapshots.set(String(guildId), snapshot);
    }
  } catch (error) {
    if (error.code !== "ENOENT") Log.warning("Failed to load player recovery snapshots", error?.message || String(error));
  }
}

function serializableSnapshots() {
  return Object.fromEntries([...snapshots.entries()].filter(([, snapshot]) => isFreshSnapshot(snapshot)));
}

function schedulePersist() {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(serializableSnapshots(), null, 2), "utf8");
    } catch (error) {
      Log.error("Failed to persist player recovery snapshots", error);
    }
  }, 250);
  writeTimer.unref?.();
}

async function saveRecoverySnapshot(player, reason = "unexpected") {
  if (!player?.guildId) return null;
  await loadSnapshots();
  const state = playbackState.get(player.guildId) || {};
  const currentTrack = cloneTrack(player.currentTrack || state.currentTrack);
  const queue = Array.from(player.queue || []).map(cloneTrack).filter(Boolean);
  if (!currentTrack && !queue.length) return null;

  const snapshot = {
    savedAt: Date.now(),
    reason,
    voiceChannel: player.voiceChannel || null,
    textChannel: player.textChannel || null,
    currentTrack,
    queue,
    position: Math.max(0, Number(state.lastPosition ?? player.position) || 0),
    paused: Boolean(player.isPaused),
    userVolume: Number(player.userVolume ?? player.volume) || 50,
    loop: player.loop || "NONE",
    filters: player.filters && typeof player.filters === "object" ? { ...player.filters } : null,
  };
  snapshots.set(String(player.guildId), snapshot);
  schedulePersist();
  Log.info("Saved player recovery snapshot", `guild=${player.guildId}`, `reason=${reason}`, `queue=${queue.length}`);
  return snapshot;
}

async function getRecoverySnapshot(guildId) {
  await loadSnapshots();
  const snapshot = snapshots.get(String(guildId)) || null;
  if (snapshot && !isFreshSnapshot(snapshot)) {
    snapshots.delete(String(guildId));
    schedulePersist();
    return null;
  }
  return snapshot;
}

async function clearRecoverySnapshot(guildId) {
  await loadSnapshots();
  snapshots.delete(String(guildId));
  schedulePersist();
}

module.exports = {
  RECOVERY_MAX_AGE_MS,
  clearRecoverySnapshot,
  getRecoverySnapshot,
  isFreshSnapshot,
  loadSnapshots,
  saveRecoverySnapshot,
};
