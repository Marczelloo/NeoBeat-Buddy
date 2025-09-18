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
  const shouldStart = !player.isPlaying && !player.currentTrack;

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
    await player.queue.add(track);
  }

  if(shouldStart) await player.play();

  return { track: nowPlaying, player, startImmediately: shouldStart };
}

async function lavalinkStop(guildId) {
  const player = poru.players.get(guildId);
  if(!player) return false;
  player.queue.clear();
  await player.destroy();
  return true;
}

async function lavalinkPause(guildId) {
  const player = poru.players.get(guildId);
  if (player && !player.isPaused) {
    await player.pause(true);
    return true;
  }
  return false;
}

async function lavalinkResume(guildId) {
  const player = poru.players.get(guildId);
  if (player && player.isPaused) {
    await player.pause(false);
    return true;
  }

  return false;
}

async function lavalinkSkip(guildId) {
  const player = poru.players.get(guildId);
  if (!player || (!player.currentTrack && player.queue.length === 0)) return false;

  await player.skip();
  return true;
}

function getPlayer(guildId) { return poru?.players.get(guildId) ?? null; }

async function lavalinkSeekToStart(guildId) 
{
  const player = getPlayer(guildId);
  if(!player?.currentTrack) return false;
  await player.seekTo(0);
  return true;
}

async function lavalinkToggleLoop(guildId) {
  const player = getPlayer(guildId);
  if (!player) return 'NONE';

  const next =
    player.loop === 'NONE' ? 'TRACK' :
    player.loop === 'TRACK' ? 'QUEUE' :
    'NONE';

  player.loop = next;
  await player.setLoop(next);
  return next;
}

async function lavalinkShuffle(guildId)
{
  const player = getPlayer(guildId);
  if(!player || player.queue.length === 0) return false;
  player.queue.shuffle();
  return true;
}

module.exports = { createPoru, lavalinkPlay, lavalinkStop, lavalinkPause, lavalinkResume, lavalinkSkip, lavalinkSeekToStart, lavalinkToggleLoop, lavalinkShuffle };
