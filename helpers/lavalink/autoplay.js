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
      "Autoplay track queued",
      "",
      `guild=${player.guildId}`,
      `track=${cloned.info?.title}`,
      `artist=${cloned.info?.author}`,
      `queueLength=${player.queue.length}`
    );

    if (!player.currentTrack && player.queue.length > 0) {
      await player.play();
    }

    return true;
  } catch (err) {
    Log.error("Failed to queue autoplay track", err, `guild=${player.guildId}`);
    return false;
  }
}

module.exports = {
  queueAutoplayTrack,
};
