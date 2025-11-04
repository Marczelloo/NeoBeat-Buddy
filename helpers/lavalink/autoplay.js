const Log = require("../logs/log");
const { fetchSmartAutoplayTrack } = require("./smartAutoplay");
const { cloneTrack } = require("./state");

async function queueAutoplayTrack(player, lastTrack, textChannelId) {
  if (!player || !lastTrack) {
    Log.warning("Autoplay called without player or lastTrack");
    return false;
  }

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
}

module.exports = {
  queueAutoplayTrack,
};
