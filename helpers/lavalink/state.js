const { TRACK_HISTORY_LIMIT } = require("./constants");
const { equalizerState } = require("./equalizerStore");

const inactivityTimers = new Map();
const playbackState = new Map();
const lyricsState = new Map();

const ensurePlaybackState = (guildId) => {
  const state = playbackState.get(guildId) || {};

  if (!state.history) state.history = [];

  playbackState.set(guildId, state);
  return state;
};

const cloneTrack = (track) => {
  if (!track) return null;

  return {
    ...track,
    info: { ...(track.info || {}) },
    pluginInfo: track.pluginInfo ? { ...track.pluginInfo } : undefined,
    userData: track.userData ? { ...track.userData } : undefined,
  };
};

const pushTrackHistory = (guildId, track) => {
  if (!track.track) return;

  const state = ensurePlaybackState(guildId);
  const history = state.history;
  history.push(cloneTrack(track));

  if (TRACK_HISTORY_LIMIT > 0 && history.length > TRACK_HISTORY_LIMIT) {
    history.splice(0, history.length - TRACK_HISTORY_LIMIT);
  }
};

const setLyricsState = (guildId, payload) => {
  if (payload) lyricsState.set(guildId, payload);
  else lyricsState.delete(guildId);
};

const getLyricsState = (guildId) => lyricsState.get(guildId) ?? null;
const clearLyricsState = (guildId) => lyricsState.delete(guildId);

module.exports = {
  inactivityTimers,
  playbackState,
  equalizerState,
  ensurePlaybackState,
  cloneTrack,
  pushTrackHistory,
  setLyricsState,
  getLyricsState,
  clearLyricsState,
};
