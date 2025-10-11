const { inspect } = require("util");
const { Poru } = require("poru");
const { errorEmbed } = require("../embeds");
const { getGuildState } = require("../guildState.js");
const Log = require("../logs/log");
const statsStore = require("../stats/store.js");
const { tryQueueFallbackTrack, describeTrack } = require("./fallbacks");
const { fetchLyrics } = require("./lyricsClient");
const {
  ensurePlaybackState,
  cloneTrack,
  pushTrackHistory,
  playbackState,
  setLyricsState,
  clearLyricsState,
} = require("./state");
const {
  clearInactivityTimer,
  scheduleInactivityDisconnect,
  clearProgressInterval,
  scheduleProgressUpdates,
} = require("./timers");

const buildPlaybackErrorMessage = (err, fallback = "Unable to play this track") => {
  if (!err) return fallback;

  const summary = typeof err === "string" ? err : err?.exception?.message ?? err?.message ?? fallback;

  const lower = summary.toLowerCase();
  if (lower.includes("age") && lower.includes("restrict")) return "YouTube blocked this track (age-restricted).";
  if (lower.includes("region") && (lower.includes("block") || lower.includes("restrict")))
    return "YouTube blocked this track (region-locked).";
  if (lower.includes("copyright") && lower.includes("claim")) return "This track is blocked due to a copyright claim.";
  if (lower.includes("copyright") && lower.includes("content"))
    return "This track is blocked due to a copyright content.";
  if (lower.includes("private video")) return "This track is a private YouTube video.";
  if (lower.includes("video unavailable")) return "This track is unavailable on YouTube.";
  if (lower.includes("429")) return "Too many requests to YouTube. Please try again later.";
  if (lower.includes("status code 5")) return "YouTube is currently experiencing issues. Please try again later.";

  return summary || fallback;
};

let poru = null;

function createPoru(client) {
  if (poru) return poru;
  const nodes = [
    {
      name: process.env.LAVALINK_NAME || "local",
      host: process.env.LAVALINK_HOST || "127.0.0.1",
      port: Number(process.env.LAVALINK_PORT || 2333),
      password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
      secure: process.env.LAVALINK_SECURE === "1",
    },
  ];

  poru = new Poru(client, nodes, {
    library: "discord.js",
    defaultPlatform: "ytsearch",
    reconnectTries: 5,
    resumeKey: process.env.LAVALINK_RESUME_KEY || undefined,
    resumeTimeout: 60,
  });

  poru.on("nodeConnect", (node) => Log.success(`Lavalink node connected ${node.name}`));

  poru.on("trackError", async (player, track, err) => {
    const errorSummary = err instanceof Error ? err.message : inspect(err, { depth: 1 });
    Log.error(
      "Lavalink track error",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `queueLength=${player.queue.length}`,
      `error=${errorSummary}`
    );
    const channel = await poru.client.channels.fetch(player.textChannel).catch(() => null);
    if (!channel) return;

    const placeholder = await channel
      .send({
        embeds: [errorEmbed("Trying alternate source", "The YouTube stream failed, looking for another version…")],
      })
      .catch(() => null);

    const fallbackTrack = await tryQueueFallbackTrack(player, track);

    if (fallbackTrack) {
      if (placeholder) {
        const title = fallbackTrack.info?.title || fallbackTrack.info?.identifier || "this track";
        await placeholder
          .edit({
            embeds: [
              errorEmbed(
                "Trying alternate source",
                `The YouTube stream failed, so I'm retrying with an alternate source for **${title}**.`
              ),
            ],
          })
          .catch(() => null);

        return;
      }

      if (placeholder) {
        await placeholder
          .edit({
            embeds: [errorEmbed("Playback error", buildPlaybackErrorMessage(err))],
          })
          .catch(() => null);

        return;
      }
    }

    if (!fallbackTrack && player.queue.length) {
      Log.warning(
        "Waiting for Lavalink auto-skip after error",
        "",
        `guild=${player.guildId}`,
        `queueLength=${player.queue.length}`
      );
    }
  });

  poru.on("trackStart", async (player, track) => {
    if (!track) {
      Log.warning("Lavalink trackStart event without track", "", `guild=${player.guildId}`);
      return;
    }

    clearInactivityTimer(player.guildId, "trackStart");
    scheduleProgressUpdates(player);

    const state = ensurePlaybackState(player.guildId);
    state.currentTrack = cloneTrack(track);
    state.lastPosition = 0;
    state.lastTimestamp = Date.now();
    playbackState.set(player.guildId, state);

    const lyricsPayload = await fetchLyrics(player, track.info).catch(() => null);
    setLyricsState(player.guildId, lyricsPayload);

    Log.info(
      "Lavalink track started",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `queueLength=${player.queue.length}`
    );

    try {
      const voiceChannel = player.poru.client.guilds.cache.get(player.guildId)?.channels.cache.get(player.voiceChannel);

      const listenerCount = voiceChannel?.members?.filter((m) => !m.user.bot).size || 0;

      statsStore.beginTrackSession(player.guildId, track, listenerCount);
    } catch (err) {
      Log.error(`Failed to begin track session for guild ${player.guildId}`, err);
    }

    poru.emit("trackStartUI", player, track);
  });

  poru.on("trackEnd", (player, track, reason) => {
    const reasonSummary = typeof reason === "string" ? reason : inspect(reason, { depth: 1 });
    const nextTrack = player.currentTrack ? describeTrack(player.currentTrack) : "none";

    clearProgressInterval(player.guildId);

    if (!player.currentTrack && player.queue.length === 0) {
      scheduleInactivityDisconnect(player, "trackEnd");
    }

    const state = ensurePlaybackState(player.guildId);
    const reasonCode = typeof reason === "string" ? reason : reason?.reason ?? null;

    if (track?.track && reasonCode !== "replaced" && reasonCode !== "load_failed") {
      pushTrackHistory(player.guildId, track);

      const updatedState = playbackState.get(player.guildId);
      Log.debug(
        "Track added to history (trackEnd)",
        "",
        `guild=${player.guildId}`,
        `track=${describeTrack(track)}`,
        `historyLength=${updatedState?.history?.length || 0}`,
        `recentHistory=${(updatedState?.history || [])
          .slice(-3)
          .map((t) => t.info?.title || "unknown")
          .join(" → ")}`
      );
    }

    Log.info(
      "Lavalink track ended",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `reason=${reasonSummary}`,
      `queueLength=${player.queue.length}`,
      `next=${nextTrack}`
    );

    state.currentTrack = null;
    playbackState.set(player.guildId, state);
    clearLyricsState(player.guildId);

    if (player.queue.length === 0) {
      player.currentTrack = null;
      player.isPlaying = false;
      player.position = 0;
    }

    if (!player.currentTrack && player.queue.length === 0) {
      scheduleInactivityDisconnect(player, "trackEndEmpty");
    }

    try {
      statsStore.finishTrackSession(player.guildId, track, reasonCode);
    } catch (err) {
      Log.error(`Failed to finish track session for guild ${player.guildId}`, err);
    }
  });

  poru.on("queueEnd", async (player) => {
    Log.info("Lavalink queue end", "", `guild=${player.guildId}`);

    const state = ensurePlaybackState(player.guildId);
    const lastTrack = state.currentTrack;

    Log.debug(
      "Queue end state",
      "",
      `guild=${player.guildId}`,
      `lastTrack=${lastTrack?.info?.title || "none"}`,
      `historyLength=${state.history?.length || 0}`,
      `lastHistoryTrack=${state.history?.[state.history.length - 1]?.info?.title || "none"}`
    );

    if (lastTrack?.track) {
      const alreadyInHistory = state.history?.some((t) => t.track === lastTrack.track);

      if (!alreadyInHistory) {
        pushTrackHistory(player.guildId, lastTrack);

        const updatedState = playbackState.get(player.guildId);
        Log.debug(
          "Track added to history (queueEnd)",
          "",
          `guild=${player.guildId}`,
          `track=${describeTrack(lastTrack)}`,
          `historyLength=${updatedState?.history?.length || 0}`,
          `recentHistory=${(updatedState?.history || [])
            .slice(-3)
            .map((t) => t.info?.title || "unknown")
            .join(" → ")}`
        );
      } else {
        Log.debug(
          "Track already in history, skipping",
          "",
          `guild=${player.guildId}`,
          `track=${describeTrack(lastTrack)}`
        );
      }
    }

    state.currentTrack = null;
    playbackState.set(player.guildId, state);

    player.currentTrack = null;
    player.isPlaying = false;
    player.isPaused = false;
    player.position = 0;

    clearProgressInterval(player.guildId);
    clearLyricsState(player.guildId);

    try {
      statsStore.abortSession(player.guildId);
    } catch (err) {
      Log.error(`Failed to abort track session for guild ${player.guildId}`, err);
    }

    const guildSettings = getGuildState(player.guildId);

    if (guildSettings?.autoplay && lastTrack) {
      Log.info("Autoplay enabled, fetching related track", "", `guild=${player.guildId}`);

      const { queueAutoplayTrack } = require("./autoplay");
      const added = await queueAutoplayTrack(player, lastTrack, player.textChannel);

      if (added) {
        return;
      }
    }

    scheduleInactivityDisconnect(player, "queueEnd");
  });

  poru.on("playerUpdate", (player) => {
    const state = playbackState.get(player.guildId) ?? {};
    state.lastPosition = player.position ?? 0;
    state.lastTimestamp = Date.now();
    playbackState.set(player.guildId, state);

    try {
      statsStore.updateProgress(player.guildId, player.position);
    } catch (err) {
      Log.error(`Failed to update track session for guild ${player.guildId}`, err);
    }
  });

  return poru;
}

module.exports = {
  createPoru,
  get poru() {
    return poru;
  },
};
