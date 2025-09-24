const Log = require("../logs/log");
const { describeTrack } = require("./fallbacks");
const { getPlayer, getPoru } = require("./players");
const { cloneTrack, playbackState, ensurePlaybackState } = require("./state");
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

async function lavalinkPlay({ guildId, voiceId, textId, query }) {
  const player = await ensurePlayer(guildId, voiceId, textId);
  const poru = getPoru();
  let startImmediately = false;

  let q = String(query || '').trim();
  const isUrl = /^(https?:\/\/)/i.test(q);
  if (!isUrl && q.toLowerCase().startsWith('ytsearch:')) {
    q = q.slice('ytsearch:'.length);
  }

  const res = await poru.resolve({ query: isUrl ? q : q });
  if (!res || !res.tracks || res.tracks.length === 0) throw new Error("No results found");

  let tracksToAdd = [];
  let nowPlaying = res.tracks[0];

  if(res.loadType === 'playlist')
  {
    const selectedIndex = res.playlistInfo?.selectedTrack ?? 0;
    nowPlaying = res.tracks[selectedIndex] ?? res.tracks[0];
    tracksToAdd = res.tracks;
  }
  else
  {
    tracksToAdd = [nowPlaying]
  }

  for(const track of tracksToAdd)
  {
    track.info.requester = textId;
    track.userData = {
      ...(track.userData || {}),
      fallbackAttempts: 0,
    };
    await player.queue.add(track);
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

  if(!player.currentTrack && player.queue.length > 0)
  {
    await player.play();
    startImmediately = true;
  }

  Log.info(
    "Queue updated",
    "",
    `guild=${guildId}`,
    `tracksAdded=${tracksToAdd.length}`,
    `startImmediately=${startImmediately}`,
    `queueLength=${player.queue.length}`
  );

  clearInactivityTimer(guildId, "playRequest");

  return { track: nowPlaying, player, startImmediately };
}

async function lavalinkStop(guildId) {
  const player = getPlayer(guildId);

  if(!player) return false;
  
  player.queue.clear();
  await player.destroy();
  clearInactivityTimer(guildId, "stopCommand");
  clearProgressInterval(guildId);
  playbackState.delete(guildId);


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
    lavalinkPrevious,
    lavalinkToggleLoop,
    lavalinkShuffle,
    lavalinkClearQueue
};