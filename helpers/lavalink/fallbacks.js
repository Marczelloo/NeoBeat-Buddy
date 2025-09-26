const { inspect } = require("util");
const Log = require("../logs/log");const { MAX_FALLBACK_ATTEMPTS } = require("./constants");

const describeTrack = (track) => {
  if (!track) return "unknown";
  const info = track.info || {};
  return `${info.title || info.identifier || "unknown"} [${info.identifier || "n/a"}]`;
};

const copyRequesterMetadata = (source = {}, target = {}) => {
  ["requester", "requesterId", "requesterTag", "requesterAvatar", "loop"].forEach((key) => {
    if (source[key] !== undefined) target[key] = source[key];
  });
  return target;
};

const buildFallbackQueries = (info = {}) => {
  const seen = new Set();
  const queries = [];
  const push = (source, query) => {
    const trimmed = (query || "").trim();
    if (!trimmed) return;
    const key = `${source}:${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ source, query: trimmed });
  };

  const author = info.author && info.author !== "Unknown" ? info.author : "";
  push("ytmsearch", [info.title, author].filter(Boolean).join(" "));
  push("ytsearch", [info.title, author].filter(Boolean).join(" "));

  if (info.identifier) {
    push("ytmsearch", info.identifier);
    push("ytsearch", info.identifier);
  }

  if (info.isrc) push("ytmsearch", info.isrc);

  return queries;
};

async function tryQueueFallbackTrack(player, failedTrack) {
  const poru = player?.poru;
  if (!failedTrack || !poru) return null;

  const info = failedTrack.info || {};
  failedTrack.userData = { ...(failedTrack.userData || {}) };
  const previousAttempts = failedTrack.userData.fallbackAttempts || 0;

  if (previousAttempts >= MAX_FALLBACK_ATTEMPTS) {
    Log.warning(
      "Fallback attempts exhausted",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(failedTrack)}`
    );
    return null;
  }

  const queries = buildFallbackQueries(info);
  if (!queries.length) {
    Log.warning(
      "No fallback query candidates",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(failedTrack)}`
    );
    failedTrack.userData.fallbackAttempts = previousAttempts + 1;
    return null;
  }

  for (const { source, query } of queries) {
    try {
      const response = await poru.resolve({ query, source });
      const fallbackTrack = response?.tracks?.find((t) => t?.track);
      if (!fallbackTrack) continue;

      const fallbackInfo = copyRequesterMetadata(info, fallbackTrack.info || (fallbackTrack.info = {}));
      if (fallbackInfo.identifier && info.identifier && fallbackInfo.identifier === info.identifier) continue;

      fallbackTrack.userData = {
        ...(fallbackTrack.userData || {}),
        fallbackParent: describeTrack(failedTrack),
        fallbackAttempts: previousAttempts + 1,
      };

      const queueWasEmpty = player.queue.length === 0 &&
        (!player.currentTrack || player.currentTrack.track === failedTrack?.track);

      player.queue.unshift(fallbackTrack);
      failedTrack.userData.fallbackAttempts = previousAttempts + 1;

      Log.info(
        "Queued fallback track",
        "",
        `guild=${player.guildId}`,
        `from=${describeTrack(failedTrack)}`,
        `to=${describeTrack(fallbackTrack)}`,
        `source=${source}`
      );

      if (queueWasEmpty) {
        try {
          await player.play();
          Log.info(
            "Started fallback playback",
            "",
            `guild=${player.guildId}`,
            `track=${describeTrack(fallbackTrack)}`
          );
        } catch (playErr) {
          const summary = playErr instanceof Error ? playErr.message : inspect(playErr, { depth: 1 });
          Log.error(
            "Failed to start fallback track",
            "",
            `guild=${player.guildId}`,
            `track=${describeTrack(fallbackTrack)}`,
            `error=${summary}`
          );
        }
      }

      return fallbackTrack;
    } catch (fallbackErr) {
      const summary = fallbackErr instanceof Error ? fallbackErr.message : inspect(fallbackErr, { depth: 1 });
      Log.warning(
        "Fallback lookup failed",
        "",
        `guild=${player.guildId}`,
        `query=${query}`,
        `source=${source}`,
        `error=${summary}`
      );
    }
  }

  failedTrack.userData.fallbackAttempts = previousAttempts + 1;
  return null;
}

module.exports = {
    tryQueueFallbackTrack,
    describeTrack,
    buildFallbackQueries,
    copyRequesterMetadata
};
