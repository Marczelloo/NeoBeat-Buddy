const Log = require("../logs/log");
const { recordAutoplayExposure } = require("./autoplayExposure");
const { fetchAutoplayV3Track } = require("./autoplayV3");
const { isAutoplayTrack } = require("./queueOrdering");
const { cloneTrack, rememberAutoplayTrack } = require("./state");

const AUTOPLAY_PREFETCH_QUEUE_THRESHOLD = 1;
const autoplayInFlight = new Map();

function getPendingManualTracks(player) {
  return Array.from(player?.queue || [])
    .filter((track) => !isAutoplayTrack(track))
    .slice(0, 4);
}

function runSharedAutoplayTask(guildId, createTask) {
  const existing = autoplayInFlight.get(guildId);
  if (existing) return existing;

  const task = Promise.resolve().then(createTask);
  autoplayInFlight.set(guildId, task);

  task.finally(() => {
    if (autoplayInFlight.get(guildId) === task) autoplayInFlight.delete(guildId);
  }).catch(() => undefined);

  return task;
}

function queueAutoplayTrack(player, lastTrack, textChannelId) {
  if (!player || !lastTrack) {
    Log.warning("Autoplay called without player or lastTrack");
    return Promise.resolve(false);
  }

  if (autoplayInFlight.has(player.guildId)) {
    Log.debug("Autoplay fetch already in progress", "", `guild=${player.guildId}`);
    return autoplayInFlight.get(player.guildId);
  }

  return runSharedAutoplayTask(player.guildId, async () => {
    try {
      const relatedTrack = await fetchAutoplayV3Track(lastTrack, player.guildId, {
        pendingManualTracks: getPendingManualTracks(player),
      });

      if (!relatedTrack) {
        Log.warning("Smart autoplay could not find a related track", "", `guild=${player.guildId}`);
        return false;
      }

      const voiceChannel = player.poru.client.guilds.cache.get(player.guildId)?.channels.cache.get(player.voiceChannel);

      const botIsInChannel = voiceChannel?.members?.has(player.poru.client.user.id);

      if (!botIsInChannel) {
        Log.debug(
          "Aborting autoplay - bot left voice channel during fetch",
          "",
          `guild=${player.guildId}`,
          `track=${relatedTrack.info?.title}`
        );
        return false;
      }

      const cloned = cloneTrack(relatedTrack);

      cloned.info = {
        ...(cloned.info || {}),
        requester: textChannelId,
        autoplayed: true,
      };

      cloned.userData = {
        ...(cloned.userData || {}),
        fallbackAttempts: 0,
        autoplay: true,
      };

      await player.queue.add(cloned);
      rememberAutoplayTrack(player.guildId, cloned);
      await recordAutoplayExposure(player.guildId, cloned, lastTrack).catch((error) => {
        Log.warning("Autoplay exposure memory update failed", "", `guild=${player.guildId}`, `error=${error.message}`);
      });

      Log.info(
        "➕ Autoplay queued",
        `${cloned.info?.title || "Unknown"}`,
        `artist=${cloned.info?.author || "Unknown"}`,
        `source=${cloned.info?.sourceName || "unknown"}`,
        `queue=${player.queue.length}`,
        `guild=${player.guildId}`
      );

      if (!player.currentTrack && player.queue.length > 0) {
        await player.play();
      }

      return true;
    } catch (err) {
      Log.error("❌ Autoplay failed", err, `guild=${player.guildId}`);
      return false;
    }
  });
}

/**
 * Starts autoplay before the queue is empty so Lavalink has a next track ready
 * when the current one finishes. The queue-end handler remains as a fallback.
 */
async function prefetchAutoplayTrack(player, currentTrack, textChannelId) {
  if (!player || !currentTrack || player.queue.length > AUTOPLAY_PREFETCH_QUEUE_THRESHOLD) return false;

  Log.debug(
    "⏩ Starting autoplay prefetch",
    "",
    `guild=${player.guildId}`,
    `queue=${player.queue.length}`,
    `current=${currentTrack.info?.title || "unknown"}`
  );

  return queueAutoplayTrack(player, currentTrack, textChannelId);
}

function isAutoplayInFlight(guildId) {
  return autoplayInFlight.has(guildId);
}

function getAutoplayInFlight(guildId) {
  return autoplayInFlight.get(guildId) || null;
}

module.exports = {
  queueAutoplayTrack,
  prefetchAutoplayTrack,
  isAutoplayInFlight,
  getAutoplayInFlight,
  runSharedAutoplayTask,
  AUTOPLAY_PREFETCH_QUEUE_THRESHOLD,
};
