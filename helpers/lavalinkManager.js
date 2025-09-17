const { Poru, Node, Track } = require("poru");
const Log = require("./logs/log");

let poru = null;

function createPoru(client) {
  if (poru) return poru;
  const nodes = [
    {
      name: process.env.LAVALINK_NAME || "local",
      host: process.env.LAVALINK_HOST || "127.0.0.1",
      port: Number(process.env.LAVALINK_PORT || 2333),
      password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
      secure: process.env.LAVALINK_SECURE === "1",
    },
  ];

  poru = new Poru(client, nodes, {
    library: "discord.js",
    defaultPlatform: "ytsearch",
    reconnectTries: 5,
    resumeKey: process.env.LAVALINK_RESUME_KEY || undefined,
    resumeTimeout: 60,
  });

  poru.on("nodeConnect", (node) => Log.success(`Lavalink node connected ${node.name}`));
  poru.on("nodeError", (node, err) => Log.error(`Lavalink node error ${node.name}`, err));
  poru.on("trackError", (player, track, err) => Log.error("Lavalink track error", { err: err?.message, title: track?.info?.title }));
  poru.on("trackEnd", (player, track, reason) => Log.info("Lavalink track ended", reason));
  poru.on("queueEnd", (player) => Log.info("Lavalink queue end"));

  return poru;
}

async function ensurePlayer(guildId, voiceId, textId) {
  const p = poru.players.get(guildId);
  if (p) return p;
  return poru.createConnection({ guildId, voiceChannel: voiceId, textChannel: textId, deaf: true });
}

async function lavalinkPlay({ guildId, voiceId, textId, query }) {
  const player = await ensurePlayer(guildId, voiceId, textId);
  let q = String(query || '').trim();
  const isUrl = /^(https?:\/\/)/i.test(q);
  // Avoid double ytsearch: prefixes; Poru defaultPlatform already handles titles
  if (!isUrl && q.toLowerCase().startsWith('ytsearch:')) {
    q = q.slice('ytsearch:'.length);
  }
  const res = await poru.resolve({ query: isUrl ? q : q });
  if (!res || !res.tracks || res.tracks.length === 0) throw new Error("No results found");
  const track = res.tracks[0];
  await player.queue.add(track);
  if (!player.isPlaying && !player.currentTrack) await player.play();
  return track;
}

module.exports = { createPoru, lavalinkPlay };
