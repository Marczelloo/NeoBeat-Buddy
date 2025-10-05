const djProposals = require("../dj/proposals");
const skipVotes = require("../dj/skipVotes");
const Log = require("../logs/log");
const { describeTrack } = require("./fallbacks");
const { getPlayer, getPoru } = require("./players");
const { cloneTrack, playbackState, ensurePlaybackState, clearLyricsState } = require("./state");
const { clearInactivityTimer, clearProgressInterval, scheduleInactivityDisconnect, scheduleProgressUpdates } = require("./timers");

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

  const defaultVolume = Number(process.env.DEFAULT_VOLUME ?? 50);
  const target = Number.isFinite(defaultVolume) ? Math.max(0, Math.min(defaultVolume, 1000)) : 50;
  
  await player.setVolume(target);
  player.volume = target;

  return player;
}

async function lavalinkResolveTracks(query) {
  const poru = getPoru();
  let q = String(query || '').trim();
  const isUrl = /^(https?:\/\/)/i.test(q);
  if (!isUrl && q.toLowerCase().startsWith('ytsearch:')) {
    q = q.slice('ytsearch:'.length);
  }

  const res = await poru.resolve({ query: isUrl ? q : q });

  const validTracks = Array.isArray(res?.tracks)
    ? res.tracks.filter((t) =>
        t &&
        typeof t.track === "string" &&
        t.track.length > 0 &&
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
  const playlistInfo = isPlaylist ? (res.playlistInfo ?? {}) : null;
  const playlistUrl = isPlaylist
    ? (playlistInfo?.uri ?? playlistInfo?.url ?? (isUrl ? q : null))
    : null;
  const playlistTrackCount = clones.length;
  const playlistDurationMs = isPlaylist
    ? clones.reduce((sum, track) => sum + (track.info?.length ?? 0), 0)
    : 0;

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

async function lavalinkPlay({ guildId, voiceId, textId, query, requester, prepend = false }) {
  const player = await ensurePlayer(guildId, voiceId, textId);

  const resolution = await lavalinkResolveTracks(query);
  const tracksToAdd = resolution.tracks.map((track) => cloneTrack(track));

  if (!tracksToAdd.length) {
    throw new Error('No playable tracks found.');
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

  const currentDescription = player.currentTrack ? describeTrack(player.currentTrack) : 'none';
  Log.info(
    "Playback state check",
    "",
    `guild=${guildId}`,
    `isPlaying=${player.isPlaying}`,
    `isPaused=${player.isPaused}`,
    `current=${currentDescription}`,
    `queueLength=${player.queue.length}`
  );

  if (!player.currentTrack && player.queue.length > 0) {
    await player.play();
  }

  Log.info(
    "Queue updated",
    "",
    `guild=${guildId}`,
    `tracksAdded=${tracksToAdd.length}`,
    `queueLength=${player.queue.length}`
  );

  clearInactivityTimer(guildId, 'playRequest');

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

  if(!player) return false;
  
  player.queue.clear();
  await player.destroy();
  clearInactivityTimer(guildId, "stopCommand");
  clearProgressInterval(guildId);
  clearLyricsState(guildId);
  playbackState.delete(guildId);
  skipVotes.clear(guildId);
  djProposals.clearGuild(guildId);

  return true;
}

async function lavalinkPause(guildId) {
  const player = getPlayer(guildId);

  if (player && !player.isPaused) 
  {
    await player.pause(true);
    clearInactivityTimer(guildId, "pauseCommand");
    return true;
  }
  
  return false;
}

async function lavalinkResume(guildId) {
  const player = getPlayer(guildId);
 

  if (player && player.isPaused) 
  {
    await player.pause(false);
    clearInactivityTimer(guildId, "resumeCommand");
    return true;
  }

  return false;
}

async function lavalinkSkip(guildId) {
  const player = getPlayer(guildId);
  if (!player || (!player.currentTrack && player.queue.length === 0)) return false;

  await player.skip();
  if(!player.currentTrack && player.queue.length === 0)
  {
    scheduleInactivityDisconnect(player, "skipEmpty");
  }
  return true;
}

async function lavalinkRemoveFromQueue(guildId, { position, title })
{
  const player = getPlayer(guildId);
  if(!player || player.queue.length === 0) return { status: "empty_queue" };

  let index = -1;

  if(typeof position === 'number')
  {
    index = position - 1;
  }
  else if(typeof title === 'string' && title.trim())
  {
    const term = title.trim().toLowerCase();
    index = player.queue.findIndex((track) => track?.info?.title?.toLowerCase().includes(term));
  }

  if(index < 0 || index >= player.queue.length) return { status: "not_found" };

  const removed = player.queue.remove(index);
  clearInactivityTimer(guildId, "removeFromQueue");

  return {
    status: "removed",
    trackTitle: removed?.info?.title ?? "Unknown title",
    index: index + 1,
  };
}

async function lavalinkPrevious(guildId)
{
  const player = getPlayer(guildId);
  if(!player) return { status: "no_player" };

  const state = ensurePlaybackState(guildId);
  const history = state.history ?? [];

  if(history.length === 0)
  {
    if(player.currentTrack)
    {
      await player.seekTo(0);
      clearInactivityTimer(guildId, "previousRestart");
      return { status: "restart", track: cloneTrack(player.currentTrack) };
    }

    return { status: "empty"};
  }

  const previous = history.pop();
  const currentClone = cloneTrack(player.currentTrack);

  if(currentClone?.track)
  {
    player.queue.unshift(currentClone);
  }

  clearProgressInterval(guildId);

  await player.node.rest.updatePlayer({
    guildId,
    data: { track: { encoded: previous.track}, position: 0 }
  })

  player.currentTrack = cloneTrack(previous);
  player.isPlaying = true;
  player.isPaused = false;
  player.position = 0;

  state.history = history;
  state.currentTrack = cloneTrack(previous);
  state.lastPosition = 0;
  state.lastTimestamp = Date.now();
  playbackState.set(guildId, state);

  clearInactivityTimer(guildId, "previousCommand");
  scheduleProgressUpdates(player);

  return { status: "previous", track: previous };
}

async function lavalinkToggleLoop(guildId, mode) {
  const player = getPlayer(guildId);
  
  if (!player) return null;

  const next = mode && ['NONE','TRACK','QUEUE'].includes(mode)
    ? mode
    : player.loop === 'NONE' ? 'TRACK'
    : player.loop === 'TRACK' ? 'QUEUE'
    : 'NONE';

  player.loop = next;
  await player.setLoop(next);
  clearInactivityTimer(guildId, 'toggleLoop');
  return next;
}

async function lavalinkShuffle(guildId)
{
  const player = getPlayer(guildId);
  
  if(!player || player.queue.length === 0) return false;
  
  player.queue.shuffle();
  clearInactivityTimer(guildId, "shuffle");
  return true;
}

async function lavalinkClearQueue(guildId)
{
  const player = getPlayer(guildId);

  if(!player || player.queue.length === 0) return false;

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
    lavalinkResolveTracks
};


