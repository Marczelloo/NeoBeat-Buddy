const { applyNormalizedVolume } = require("./loudness");
const { getPlayer } = require("./players");

async function lavalinkSetVolume(guildId, volume) {
  const player = getPlayer(guildId);

  if (!player) return null;

  const clamped = Math.max(0, Math.min(volume, 100));
  player.userVolume = clamped;
  await applyNormalizedVolume(player, player.currentTrack);
  return clamped;
}

async function lavalinkGetVolume(guildId) {
  const player = getPlayer(guildId);
  return player ? player.userVolume ?? player.volume ?? 100 : null;
}

module.exports = {
  lavalinkSetVolume,
  lavalinkGetVolume,
};
