const Log = require("../logs/log");
const { getPoru } = require("./players");
const { cloneTrack } = require("./state");

async function fetchRelatedTrack(referenceTrack) {
  if (!referenceTrack?.info) return null;

  const poru = getPoru();
  const { title, author, identifier, sourceName } = referenceTrack.info;

  try {
    if (sourceName === "youtube" || identifier) {
      try {
        const radioQuery = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
        const radioRes = await poru.resolve({ query: radioQuery });

        if (radioRes?.tracks?.length > 1) {
          const randomIndex = Math.floor(Math.random() * Math.min(10, radioRes.tracks.length - 1)) + 1;
          const track = radioRes.tracks[randomIndex];

          if (track?.track) {
            Log.info("Autoplay found related track (YouTube Mix)", "", `source=${title}`, `found=${track.info?.title}`);
            return cloneTrack(track);
          }
        }
      } catch (err) {
        Log.warning("YouTube Mix autoplay failed, trying fallback", err.message);
      }
    }

    const searchQuery = `${title} ${author}`.trim();

    if (!searchQuery) {
      Log.warning("Autoplay cannot construct search query from track metadata");
      return null;
    }

    const searchRes = await poru.resolve({
      query: `ytsearch:${searchQuery} official audio`,
    });

    if (!searchRes?.tracks?.length) {
      Log.warning("Autoplay search returned no results", "", `query=${searchQuery}`);
      return null;
    }

    const candidates = searchRes.tracks.filter((t) => t?.info?.identifier !== identifier).slice(0, 10);

    if (candidates.length === 0) {
      Log.warning("Autoplay found no different tracks");
      return null;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selected = candidates[randomIndex];

    Log.info("Autoplay found related track (Search)", "", `source=${title}`, `found=${selected.info?.title}`);

    return cloneTrack(selected);
  } catch (err) {
    Log.error("Autoplay track fetch failed", err);
    return null;
  }
}

async function queueAutoplayTrack(player, lastTrack, textChannelId) {
  if (!player || !lastTrack) {
    Log.warning("Autoplay called without player or lastTrack");
    return false;
  }

  try {
    const relatedTrack = await fetchRelatedTrack(lastTrack);

    if (!relatedTrack) {
      Log.warning("Autoplay could not find a related track", "", `guild=${player.guildId}`);
      return false;
    }

    relatedTrack.info = {
      ...(relatedTrack.info || {}),
      requester: textChannelId,
      autoplayed: true,
    };

    relatedTrack.userData = {
      ...(relatedTrack.userData || {}),
      fallbackAttempts: 0,
      autoplay: true,
    };

    await player.queue.add(relatedTrack);

    Log.info(
      "Autoplay track queued",
      "",
      `guild=${player.guildId}`,
      `track=${relatedTrack.info?.title}`,
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
  fetchRelatedTrack,
};
