const { TRACK_HISTORY_LIMIT } = require("./constants");

const inactivityTimers = new Map();
const playbackState = new Map();
const equalizerState = new Map();

const ensurePlaybackState = (guildId) => {
  const state = playbackState.get(guildId) || {};

  if(!state.history) state.history = [];

  playbackState.set(guildId, state);
  return state;
}

const cloneTrack = (track) => {
  if(!track) return null;

  return {
    ...track,
    info: { ...(track.info || {}) },
    pluginInfo: track.pluginInfo ? { ...(track.pluginInfo) } : undefined,
    userData: track.userData ? { ...(track.userData) } : undefined,
  }
}

const pushTrackHistory = (guildId, track) => {
  if(!track.track) return;

  const state = ensurePlaybackState(guildId);
  const history = state.history;
  history.push(cloneTrack(track));

  if(TRACK_HISTORY_LIMIT > 0 && history.length > TRACK_HISTORY_LIMIT)
  {
    history.splice(0, history.length - TRACK_HISTORY_LIMIT);
  }
}

module.exports = {
  inactivityTimers,
  playbackState,
  equalizerState,
  ensurePlaybackState,
  cloneTrack,
  pushTrackHistory,
};