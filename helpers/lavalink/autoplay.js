const Log = require("../logs/log");
const { recordAutoplayExposure } = require("./autoplayExposure");
const { fetchSmartAutoplayTrack } = require("./smartAutoplay");
const { cloneTrack, rememberAutoplayTrack } = require("./state");

const AUTOPLAY_PREFETCH_QUEUE_THRESHOLD = 1;
const autoplayInFlight = new Set();

async function queueAutoplayTrack(player, lastTrack, textChannelId) {
  if (!player || !lastTrack) {
    Log.warning("Autoplay called without player or lastTrack");
    return false;
  }

  if (autoplayInFlight.has(player.guildId)) {
    Log.debug("Autoplay fetch already in progress", "", `guild=${player.guildId}`);
    return false;
  }

  autoplayInFlight.add(player.guildId);

  try {
    const relatedTrack = await fetchSmartAutoplayTrack(lastTrack, player.guildId);

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
  } finally {
    autoplayInFlight.delete(player.guildId);
  }
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

module.exports = {
  queueAutoplayTrack,
  prefetchAutoplayTrack,
  isAutoplayInFlight,
  AUTOPLAY_PREFETCH_QUEUE_THRESHOLD,
};
