const { TRACK_HISTORY_LIMIT } = require("./constants");
const { equalizerState } = require("./equalizerStore");
const { getTrackIdentity } = require("./trackIdentity");

const inactivityTimers = new Map();
const playbackState = new Map();
const lyricsState = new Map();
const AUTOPLAY_HISTORY_LIMIT = Number(process.env.AUTOPLAY_HISTORY_LIMIT ?? 80);

const ensurePlaybackState = (guildId) => {
  const state = playbackState.get(guildId) || {};

  if (!state.history) state.history = [];
  if (!state.autoplayHistory) state.autoplayHistory = [];

  playbackState.set(guildId, state);
  return state;
};

const rememberAutoplayTrack = (guildId, track) => {
  if (!track?.track && !track?.info) return;

  const state = ensurePlaybackState(guildId);
  const identity = getTrackIdentity(track);
  const identityKey = identity.textKey || (identity.identifier ? `id:${identity.identifier}` : null);
  if (!identityKey) return;

  state.autoplayHistory = state.autoplayHistory.filter((entry) => entry.identityKey !== identityKey);
  state.autoplayHistory.push({ identityKey, track: cloneTrack(track) });

  if (AUTOPLAY_HISTORY_LIMIT > 0 && state.autoplayHistory.length > AUTOPLAY_HISTORY_LIMIT) {
    state.autoplayHistory.splice(0, state.autoplayHistory.length - AUTOPLAY_HISTORY_LIMIT);
  }
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
  rememberAutoplayTrack,
  setLyricsState,
  getLyricsState,
  clearLyricsState,
};
