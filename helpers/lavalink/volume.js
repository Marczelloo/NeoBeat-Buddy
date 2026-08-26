const { applyNormalizedVolume, getUserVolume } = require("./loudness");
const { getPlayer } = require("./players");

function clampVolume(volume) {
  return Math.max(0, Math.min(Number(volume) || 0, 100));
}

function getRestoreVolume(player) {
  const remembered = clampVolume(player?.lastAudibleVolume);
  if (remembered > 0) return remembered;

  const configuredDefault = clampVolume(process.env.DEFAULT_VOLUME ?? 50);
  return configuredDefault > 0 ? configuredDefault : 50;
}

async function setPlayerVolume(player, volume) {
  if (!player) return null;

  const clamped = clampVolume(volume);
  if (clamped > 0) {
    player.lastAudibleVolume = clamped;
    player.isMuted = false;
  } else {
    const currentVolume = clampVolume(getUserVolume(player));
    if (currentVolume > 0) player.lastAudibleVolume = currentVolume;
    player.isMuted = true;
  }

  player.userVolume = clamped;
  await applyNormalizedVolume(player, player.currentTrack);
  return clamped;
}

async function lavalinkSetVolume(guildId, volume) {
  return setPlayerVolume(getPlayer(guildId), volume);
}

async function lavalinkToggleMute(guildId) {
  const player = getPlayer(guildId);
  if (!player) return null;

  const muted = Boolean(player.isMuted) || clampVolume(getUserVolume(player)) === 0;
  const volume = muted ? getRestoreVolume(player) : 0;
  await setPlayerVolume(player, volume);
  return { muted: !muted, volume };
}

async function lavalinkGetVolume(guildId) {
  const player = getPlayer(guildId);
  return player ? player.userVolume ?? player.volume ?? 100 : null;
}

module.exports = {
  clampVolume,
  getRestoreVolume,
  lavalinkToggleMute,
  lavalinkSetVolume,
  lavalinkGetVolume,
  setPlayerVolume,
};
