const { getPlayer } = require("./players");
const { ensurePlaybackState, playbackState } = require("./state");
const { clearInactivityTimer } = require("./timers");
const { resyncLyricsSession } = require("./lyricsFormatter");

async function lavalinkSeekTo(guildId, positionMs) {
  const player = getPlayer(guildId);

  if (!player?.currentTrack) return false;

  const rawLength = player.currentTrack.info?.length;
  const maxLength = Number.isFinite(Number(rawLength)) ? Number(rawLength) : Number.POSITIVE_INFINITY;
  const clamped = Math.max(0, Math.min(positionMs, maxLength));

  await player.node.rest.updatePlayer({ guildId, data: { position: clamped } });
  player.position = clamped;

  const state = ensurePlaybackState(guildId);
  state.lastPosition = clamped;
  state.lastTimestamp = Date.now();
  playbackState.set(guildId, state);
  resyncLyricsSession(guildId);

  clearInactivityTimer(guildId, "seekTo");
  return true;
}

async function lavalinkGetDuration(guildId) {
  const player = getPlayer(guildId);
  if (!player || !player.currentTrack) return null;

  return player.currentTrack.info.length || null;
}

module.exports = {
  lavalinkSeekTo,
  lavalinkGetDuration,
};
