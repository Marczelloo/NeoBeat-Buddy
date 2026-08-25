const Log = require("../logs/log");
const { TRACK_START_TIMEOUT_MS } = require("./constants");

const startWatchdogs = new Map();

function trackKey(track) {
  if (!track) return null;
  const info = track.info || {};
  return String(track.track || track.encoded || info.identifier || `${info.author || ""}::${info.title || ""}`) || null;
}

function clearTrackStartWatchdog(guildId, reason = "unspecified") {
  const active = startWatchdogs.get(guildId);
  if (!active) return;

  clearTimeout(active.timer);
  startWatchdogs.delete(guildId);
  Log.debug("Cleared track-start watchdog", "", `guild=${guildId}`, `reason=${reason}`);
}

function armTrackStartWatchdog(player, expectedTrack, onTimeout, { timeoutMs = TRACK_START_TIMEOUT_MS } = {}) {
  const guildId = player?.guildId;
  const expectedKey = trackKey(expectedTrack);
  const timeout = Number(timeoutMs);
  if (!guildId || !expectedKey || typeof onTimeout !== "function" || !Number.isFinite(timeout) || timeout <= 0) return null;

  clearTrackStartWatchdog(guildId, "rearmed");

  const active = { expectedKey, timer: null };
  active.timer = setTimeout(async () => {
    if (startWatchdogs.get(guildId) !== active) return;
    startWatchdogs.delete(guildId);

    const currentPlayer = player?.poru?.players?.get(guildId) || player;
    if (!currentPlayer || currentPlayer.isPaused) return;

    const currentKey = trackKey(currentPlayer.currentTrack);
    if (currentKey && currentKey !== expectedKey) {
      Log.debug("Track-start watchdog ignored stale transition", "", `guild=${guildId}`);
      return;
    }

    Log.warning(
      "Track start timed out; recovering playback",
      "",
      `guild=${guildId}`,
      `track=${currentPlayer.currentTrack?.info?.title || expectedTrack.info?.title || "unknown"}`,
      `timeoutMs=${timeout}`
    );

    try {
      await onTimeout(currentPlayer, currentPlayer.currentTrack || expectedTrack);
    } catch (error) {
      Log.error("Track-start watchdog recovery failed", error, `guild=${guildId}`);
    }
  }, timeout);

  active.timer.unref?.();
  startWatchdogs.set(guildId, active);
  Log.debug("Armed track-start watchdog", "", `guild=${guildId}`, `track=${expectedTrack.info?.title || "unknown"}`, `timeoutMs=${timeout}`);
  return active;
}

function getTrackStartWatchdog(guildId) {
  return startWatchdogs.get(guildId) || null;
}

module.exports = {
  armTrackStartWatchdog,
  clearTrackStartWatchdog,
  getTrackStartWatchdog,
  trackKey,
};
