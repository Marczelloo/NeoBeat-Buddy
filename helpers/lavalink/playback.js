const djProposals = require("../dj/proposals");
const skipVotes = require("../dj/skipVotes");
const { deletePanelState } = require("../equalizer/panel");
const { clearPendingUpdates } = require("../equalizer/throttle");
const Log = require("../logs/log");
const statsStore = require("../stats/store");
const { getEqualizerState } = require("./equalizerStore");
const { describeTrack } = require("./fallbacks");
const { getPlayer, getPoru } = require("./players");
const { cloneTrack, playbackState, ensurePlaybackState, clearLyricsState } = require("./state");
const {
  clearInactivityTimer,
  clearProgressInterval,
  scheduleInactivityDisconnect,
  scheduleProgressUpdates,
} = require("./timers");

async function ensurePlayer(guildId, voiceId, textId) {
  let player = getPlayer(guildId);
  const poru = getPoru();

  if (player) return player;

  player = await poru.createConnection({
    guildId,
    voiceChannel: voiceId,
    textChannel: textId,
    deaf: true,
  });

  statsStore.beginSession(guildId);

  const defaultVolume = Number(process.env.DEFAULT_VOLUME ?? 50);
  const target = Number.isFinite(defaultVolume) ? Math.max(0, Math.min(defaultVolume, 1000)) : 50;

  await player.setVolume(target);
  player.volume = target;

  const savedEq = getEqualizerState(guildId);

  if (savedEq?.equalizer?.length) {
    try {
      await player.node.rest.updatePlayer({
        guildId,
        data: { filters: savedEq },
      });
      player.filters = savedEq;
    } catch (err) {
      Log.error("Failed to restore EQ settings", err, `guild=${guildId}`);
    }
  }
  return player;
}

async function lavalinkResolveTracks(query, source = "deezer") {
  const poru = getPoru();
  let q = String(query || "").trim();
  const isUrl = /^(https?:\/\/)/i.test(q);

  // For URLs (Spotify/YouTube links), let Lavalink handle via providers chain
  // For search queries, use the specified source
  let res = null;
  const hasSourcePrefix = q.match(/^(dzsearch:|ytsearch:|spsearch:|ytmsearch:)/i);

  if (!isUrl && !hasSourcePrefix) {
    // Remove any existing search prefix
    let searchQuery = q;
    if (q.toLowerCase().startsWith("ytsearch:")) {
      searchQuery = q.slice("ytsearch:".length).trim();
    }

    // Try specified source first
    try {
      const sourcePrefix = source === "youtube" ? "ytsearch" : source === "spotify" ? "spsearch" : "dzsearch";
      const sourceName = source === "youtube" ? "YouTube" : source === "spotify" ? "Spotify" : "Deezer";

      Log.info(`🔍 ${sourceName} search`, `query=${searchQuery}`);
      const node = poru.leastUsedNodes[0];
      if (node) {
        const searchUrl = `http://${node.options.host}:${
          node.options.port
        }/v4/loadtracks?identifier=${encodeURIComponent(`${sourcePrefix}:${searchQuery}`)}`;
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: node.options.password },
        });
        const searchData = await searchResponse.json();

        if (searchData?.loadType === "search" && Array.isArray(searchData?.data) && searchData.data.length > 0) {
          Log.info(
            `✅ ${sourceName} found tracks`,
            `count=${searchData.data.length}`,
            `topResult=${searchData.data[0]?.info?.title || "Unknown"}`,
            `query=${searchQuery}`
          );
          res = {
            loadType: searchData.loadType,
            tracks: searchData.data,
            playlistInfo: searchData.playlistInfo,
          };
        } else {
          Log.info(
            `⚠️ ${sourceName} no results, trying fallback`,
            `loadType=${searchData?.loadType}`,
            `query=${searchQuery}`
          );

          // Fallback to YouTube if primary source failed
          if (source !== "youtube") {
            const ytUrl = `http://${node.options.host}:${
              node.options.port
            }/v4/loadtracks?identifier=${encodeURIComponent(`ytsearch:${searchQuery}`)}`;
            const ytResponse = await fetch(ytUrl, {
              headers: { Authorization: node.options.password },
            });
            const ytData = await ytResponse.json();

            if (ytData?.loadType === "search" && Array.isArray(ytData?.data) && ytData.data.length > 0) {
              Log.info("✅ YouTube fallback found tracks", `count=${ytData.data.length}`, `query=${searchQuery}`);
              res = {
                loadType: ytData.loadType,
                tracks: ytData.data,
                playlistInfo: ytData.playlistInfo,
              };
            }
          }
        }
      }
    } catch (err) {
      Log.warn(`${source} search failed, falling back to YouTube`, err, `query=${searchQuery}`);
    }
  }

  // If source search didn't work, it's a URL, or already has a source prefix, resolve normally
  if (!res) {
    const resolveQuery = hasSourcePrefix ? q : isUrl ? q : q;
    res = await poru.resolve({ query: resolveQuery });
  }

  const validTracks = Array.isArray(res?.tracks)
    ? res.tracks.filter(
        (t) =>
          t &&
          (typeof t.track === "string" || typeof t.encoded === "string") &&
          (t.track?.length > 0 || t.encoded?.length > 0) &&
          t.info &&
          typeof t.info === "object"
      )
    : [];

  if (!validTracks.length) {
    throw new Error(
      res?.loadType === "loadFailed"
        ? res?.exception?.message ?? "Failed to load track (Lavalink error)."
        : "No playable tracks found."
    );
  }

  let tracksToAdd = validTracks;
  let nowPlaying = validTracks[0];

  if (res.loadType === "playlist") {
    const selectedIndex = res.playlistInfo?.selectedTrack ?? 0;
    nowPlaying = tracksToAdd[selectedIndex] ?? nowPlaying;
  } else {
    tracksToAdd = [nowPlaying];
  }

  const clones = tracksToAdd.map((track) => cloneTrack(track));
  const selectedClone = cloneTrack(nowPlaying);

  const isPlaylist = res.loadType === "playlist";
  const playlistInfo = isPlaylist ? res.playlistInfo ?? {} : null;
  const playlistUrl = isPlaylist ? playlistInfo?.uri ?? playlistInfo?.url ?? (isUrl ? q : null) : null;
  const playlistTrackCount = clones.length;
  const playlistDurationMs = isPlaylist ? clones.reduce((sum, track) => sum + (track.info?.length ?? 0), 0) : 0;

  return {
    tracks: clones,
    track: selectedClone,
    isPlaylist,
    playlistInfo,
    playlistUrl,
    playlistTrackCount,
    playlistDurationMs,
  };
}

async function lavalinkPlay({ guildId, voiceId, textId, query, requester, prepend = false, source = "deezer" }) {
  const player = await ensurePlayer(guildId, voiceId, textId);

  const resolution = await lavalinkResolveTracks(query, source);
  const tracksToAdd = resolution.tracks.map((track) => cloneTrack(track));

  if (!tracksToAdd.length) {
    throw new Error("No playable tracks found.");
  }

  const targetEncoded = resolution.track?.track ?? tracksToAdd[0].track;
  let nowPlaying = tracksToAdd.find((track) => track.track === targetEncoded) ?? tracksToAdd[0];

  const requesterMeta = requester
    ? {
        requesterId: requester.id,
        requesterTag: requester.tag,
        requesterAvatar: requester.avatar,
      }
    : {};

  const shouldPrepend = prepend && player.queue.length > 0;
  const queueTargets = shouldPrepend ? [...tracksToAdd].reverse() : tracksToAdd;

  for (const track of queueTargets) {
    if (!track) continue;

    track.info = { ...(track.info || {}), ...requesterMeta, requester: textId };
    track.userData = {
      ...(track.userData || {}),
      fallbackAttempts: 0,
    };

    if (shouldPrepend) await player.queue.unshift(track);
    else await player.queue.add(track);
  }

  const currentTitle = player.currentTrack?.info?.title || "none";
  Log.info(
    "🔍 Playback check",
    `current=${currentTitle}`,
    `playing=${player.isPlaying}`,
    `paused=${player.isPaused}`,
    `queue=${player.queue.length}`,
    `guild=${guildId}`
  );

  if (!player.currentTrack && player.queue.length > 0) {
    await player.play();
  }

  Log.info("➕ Queue updated", `added=${tracksToAdd.length}`, `queue=${player.queue.length}`, `guild=${guildId}`);

  clearInactivityTimer(guildId, "playRequest");

  return {
    track: cloneTrack(nowPlaying),
    player,
    isPlaylist: resolution.isPlaylist,
    playlistInfo: resolution.playlistInfo,
    playlistUrl: resolution.playlistUrl,
    playlistTrackCount: resolution.playlistTrackCount,
    playlistDurationMs: resolution.playlistDurationMs,
  };
}

async function lavalinkStop(guildId) {
  const player = getPlayer(guildId);

  if (!player) return false;

  const queueSize = player.queue.length;
  const currentTrack = player.currentTrack?.info?.title || "none";

  Log.info("⏹️ Player stopped", `currentTrack=${currentTrack}`, `clearedQueue=${queueSize}`, `guild=${guildId}`);

  player.queue.clear();
  await player.destroy();
  clearInactivityTimer(guildId, "stopCommand");
  clearProgressInterval(guildId);
  clearLyricsState(guildId);
  playbackState.delete(guildId);
  skipVotes.clear(guildId);
  djProposals.clearGuild(guildId);
  deletePanelState(guildId);
  clearPendingUpdates(guildId);

  return true;
}

async function lavalinkPause(guildId) {
  const player = getPlayer(guildId);

  if (player && !player.isPaused) {
    const trackTitle = player.currentTrack?.info?.title || "Unknown";
    Log.info("⏸️ Player paused", `track=${trackTitle}`, `guild=${guildId}`);
    await player.pause(true);
    clearInactivityTimer(guildId, "pauseCommand");
    return true;
  }

  return false;
}

async function lavalinkResume(guildId) {
  const player = getPlayer(guildId);

  if (player && player.isPaused) {
    const trackTitle = player.currentTrack?.info?.title || "Unknown";
    Log.info("▶️ Player resumed", `track=${trackTitle}`, `guild=${guildId}`);
    await player.pause(false);
    clearInactivityTimer(guildId, "resumeCommand");
    return true;
  }

  return false;
}

async function lavalinkSkip(guildId) {
  const player = getPlayer(guildId);
  if (!player || (!player.currentTrack && player.queue.length === 0)) return false;

  const skippedTitle = player.currentTrack?.info?.title || "Unknown";
  const nextTitle = player.queue[0]?.info?.title || "none";

  Log.info(
    "⏭️ Track skipped",
    `from=${skippedTitle}`,
    `to=${nextTitle}`,
    `queue=${player.queue.length}`,
    `guild=${guildId}`
  );

  const result = await player.skip();

  if (!player.currentTrack && player.queue.length === 0) {
    scheduleInactivityDisconnect(player, "skipEmpty");
  }

  if (result) {
    statsStore.trackSkip(guildId);

    // Record skip in health monitoring
    const health = require("../monitoring/health");
    health.recordTrackSkipped();
  }

  return true;
}

async function lavalinkRemoveFromQueue(guildId, { position, title }) {
  const player = getPlayer(guildId);
  if (!player || player.queue.length === 0) return { status: "empty_queue" };

  let index = -1;

  if (typeof position === "number") {
    index = position - 1;
  } else if (typeof title === "string" && title.trim()) {
    const term = title.trim().toLowerCase();
    index = player.queue.findIndex((track) => track?.info?.title?.toLowerCase().includes(term));
  }

  if (index < 0 || index >= player.queue.length) return { status: "not_found" };

  const removed = player.queue.remove(index);
  const removedTitle = removed?.info?.title ?? "Unknown title";

  Log.info(
    "➖ Track removed",
    `track=${removedTitle}`,
    `position=${index + 1}`,
    `queue=${player.queue.length}`,
    `guild=${guildId}`
  );

  clearInactivityTimer(guildId, "removeFromQueue");

  return {
    status: "removed",
    trackTitle: removedTitle,
    index: index + 1,
  };
}

async function lavalinkPrevious(guildId) {
  const player = getPlayer(guildId);
  if (!player) return { status: "no_player" };

  const state = ensurePlaybackState(guildId);
  const history = state.history ?? [];

  if (history.length === 0) {
    if (player.currentTrack) {
      await player.seekTo(0);
      clearInactivityTimer(guildId, "previousRestart");

      // Update the player message to show position reset
      const { refreshNowPlayingMessage } = require("../buttons");
      const { getClient } = require("../clientRegistry");
      const client = getClient();
      if (client) {
        await refreshNowPlayingMessage(client, guildId, player, player.loop ?? "NONE", 0);
      }

      return { status: "restart", track: cloneTrack(player.currentTrack) };
    }

    return { status: "empty" };
  }

  const previous = history.pop();
  const currentClone = cloneTrack(player.currentTrack);

  const previousTitle = previous?.info?.title || "Unknown";
  const currentTitle = currentClone?.info?.title || "none";

  Log.info(
    "⏮️ Previous track",
    `from=${currentTitle}`,
    `to=${previousTitle}`,
    `historySize=${history.length}`,
    `guild=${guildId}`
  );

  if (currentClone?.track) {
    player.queue.unshift(currentClone);
  }

  clearProgressInterval(guildId);

  // Update player state before calling updatePlayer
  player.currentTrack = cloneTrack(previous);
  player.isPlaying = true;
  player.isPaused = false;
  player.position = 0;

  await player.node.rest.updatePlayer({
    guildId,
    data: { track: { encoded: previous.track }, position: 0 },
  });

  state.history = history;
  state.currentTrack = cloneTrack(previous);
  state.lastPosition = 0;
  state.lastTimestamp = Date.now();
  playbackState.set(guildId, state);

  clearInactivityTimer(guildId, "previousCommand");
  scheduleProgressUpdates(player);

  // Let Lavalink's trackStart event handle the UI update

  return { status: "previous", track: previous };
}

async function lavalinkToggleLoop(guildId, mode) {
  const player = getPlayer(guildId);

  if (!player) return null;

  // Determine next loop mode
  const currentLoop = player.loop || "NONE";

  const next =
    mode && ["NONE", "TRACK", "QUEUE"].includes(mode)
      ? mode
      : currentLoop === "NONE"
      ? "TRACK"
      : currentLoop === "TRACK"
      ? "QUEUE"
      : "NONE";

  // Set loop mode on player
  player.loop = next;

  clearInactivityTimer(guildId, "toggleLoop");

  return next;
}

async function lavalinkShuffle(guildId) {
  const player = getPlayer(guildId);

  if (!player || player.queue.length === 0) return false;

  player.queue.shuffle();
  clearInactivityTimer(guildId, "shuffle");
  return true;
}

async function lavalinkClearQueue(guildId) {
  const player = getPlayer(guildId);

  if (!player || player.queue.length === 0) return false;

  player.queue.clear();
  clearInactivityTimer(guildId, "clearQueue");
  return true;
}

module.exports = {
  lavalinkPlay,
  lavalinkStop,
  lavalinkPause,
  lavalinkResume,
  lavalinkSkip,
  lavalinkRemoveFromQueue,
  lavalinkPrevious,
  lavalinkToggleLoop,
  lavalinkShuffle,
  lavalinkClearQueue,
  lavalinkResolveTracks,
};
