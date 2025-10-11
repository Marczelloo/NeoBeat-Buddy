const client = require("./client");
const { ensurePlaybackState } = require("./state");

function getPoru() {
  return client.poru;
}

function getPlayer(guildId) {
  const poru = client.poru;
  return poru?.players.get(guildId) ?? null;
}

async function ensurePlayer(guildId, voiceChannelId, textChannelId) {
  const poru = client.poru;
  if (!poru) throw new Error("Poru is not initialised yet.");

  let player = poru.players.get(guildId);
  if (player) return player;

  player = await poru.createConnection({
    guildId,
    voiceChannel: voiceChannelId,
    textChannel: textChannelId,
    deaf: true,
  });

  ensurePlaybackState(guildId);
  return player;
}

module.exports = { getPoru, getPlayer, ensurePlayer };
