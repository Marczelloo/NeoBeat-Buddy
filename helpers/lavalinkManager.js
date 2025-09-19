const { Poru, Node, Track } = require("poru");
const Log = require("./logs/log");
const { errorEmbed } = require("./embeds");
const { inspect } = require("util");

const describeTrack = (track) => {
  if (!track) return "unknown";
  const info = track.info || {};
  return `${info.title || info.identifier || "unknown"} [${info.identifier || "n/a"}]`;
};

const MAX_FALLBACK_ATTEMPTS = 1;

const copyRequesterMetadata = (source = {}, target = {}) => {
  ["requester", "requesterId", "requesterTag", "requesterAvatar", "loop"].forEach((key) => {
    if (source[key] !== undefined) target[key] = source[key];
  });
  return target;
};

const buildFallbackQueries = (info = {}) => {
  const seen = new Set();
  const queries = [];
  const push = (source, query) => {
    const trimmed = (query || "").trim();
    if (!trimmed) return;
    const key = `${source}:${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ source, query: trimmed });
  };

  const author = info.author && info.author !== "Unknown" ? info.author : "";
  push("ytmsearch", [info.title, author].filter(Boolean).join(" "));
  push("ytsearch", [info.title, author].filter(Boolean).join(" "));

  if (info.identifier) {
    push("ytmsearch", info.identifier);
    push("ytsearch", info.identifier);
  }

  if (info.isrc) push("ytmsearch", info.isrc);

  return queries;
};

async function tryQueueFallbackTrack(player, failedTrack) {
  if (!failedTrack || !poru) return null;

  const info = failedTrack.info || {};
  failedTrack.userData = { ...(failedTrack.userData || {}) };
  const previousAttempts = failedTrack.userData.fallbackAttempts || 0;

  if (previousAttempts >= MAX_FALLBACK_ATTEMPTS) {
    Log.warning(
      "Fallback attempts exhausted",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(failedTrack)}`
    );
    return null;
  }

  const queries = buildFallbackQueries(info);
  if (!queries.length) {
    Log.warning(
      "No fallback query candidates",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(failedTrack)}`
    );
    failedTrack.userData.fallbackAttempts = previousAttempts + 1;
    return null;
  }

  for (const { source, query } of queries) {
    try {
      const response = await poru.resolve({ query, source });
      const fallbackTrack = response?.tracks?.find((t) => t?.track);
      if (!fallbackTrack) continue;

      const fallbackInfo = copyRequesterMetadata(info, fallbackTrack.info || (fallbackTrack.info = {}));
      if (fallbackInfo.identifier && info.identifier && fallbackInfo.identifier === info.identifier) continue;

      fallbackTrack.userData = {
        ...(fallbackTrack.userData || {}),
        fallbackParent: describeTrack(failedTrack),
        fallbackAttempts: previousAttempts + 1,
      };

      player.queue.unshift(fallbackTrack);
      failedTrack.userData.fallbackAttempts = previousAttempts + 1;

      Log.info(
        "Queued fallback track",
        "",
        `guild=${player.guildId}`,
        `from=${describeTrack(failedTrack)}`,
        `to=${describeTrack(fallbackTrack)}`,
        `source=${source}`
      );

      return fallbackTrack;
    } catch (fallbackErr) {
      const summary = fallbackErr instanceof Error ? fallbackErr.message : inspect(fallbackErr, { depth: 1 });
      Log.warning(
        "Fallback lookup failed",
        "",
        `guild=${player.guildId}`,
        `query=${query}`,
        `source=${source}`,
        `error=${summary}`
      );
    }
  }

  failedTrack.userData.fallbackAttempts = previousAttempts + 1;
  return null;
}

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
  poru.on("trackError", async (player, track, err) => {
    const errorSummary = err instanceof Error ? err.message : inspect(err, { depth: 1 });
    Log.error(
      "Lavalink track error",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `queueLength=${player.queue.length}`,
      `error=${errorSummary}`
    );

    const fallbackTrack = await tryQueueFallbackTrack(player, track);
    const channel = await poru.client.channels.fetch(player.textChannel).catch(() => null);

    if (fallbackTrack) {
      if (channel) {
        await channel.send({
          embeds: [errorEmbed(
            "Trying alternate source",
            `The YouTube stream failed, so I'm retrying with an alternate source for **${fallbackTrack.info.title || fallbackTrack.info.identifier || "this track"}**.`
          )],
        }).catch(() => null);
      }
    } else if (channel) {
      await channel.send({
        embeds: [errorEmbed("Track unavailable", "YouTube blocked this track (age-restricted or region-locked).")],
      }).catch(() => null);
    }

    if (!fallbackTrack && player.queue.length) {
      Log.warning(
        "Waiting for Lavalink auto-skip after error",
        "",
        `guild=${player.guildId}`,
        `queueLength=${player.queue.length}`
      );
    }
  });
  poru.on("trackError", async (player, track, err) => {
    const errorSummary = err instanceof Error ? err.message : inspect(err, { depth: 1 });
    Log.error(
      "Lavalink track error",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `queueLength=${player.queue.length}`,
      `error=${errorSummary}`
    );

    const channel = await poru.client.channels.fetch(player.textChannel).catch(() => null);
    if (channel) {
      await channel.send({
        embeds: [errorEmbed("Track unavailable", "YouTube blocked this track (age-restricted or region-locked).")],
      });
    }

    if (player.queue.length) {
      Log.warning(
        "Waiting for Lavalink auto-skip after error",
        "",
        `guild=${player.guildId}`,
        `queueLength=${player.queue.length}`
      );
    }
  });
  poru.on("trackStart", (player, track) => {
    Log.info(
      "Lavalink track started",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `queueLength=${player.queue.length}`
    );
  });
  poru.on("trackEnd", (player, track, reason) => {
    const reasonSummary = typeof reason === "string" ? reason : inspect(reason, { depth: 1 });
    const nextTrack = player.currentTrack ? describeTrack(player.currentTrack) : "none";
    Log.info(
      "Lavalink track ended",
      "",
      `guild=${player.guildId}`,
      `track=${describeTrack(track)}`,
      `reason=${reasonSummary}`,
      `queueLength=${player.queue.length}`,
      `next=${nextTrack}`
    );
  });
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
    track.userData = {
      ...(track.userData || {}),
      fallbackAttempts: 0,
    };
    await player.queue.add(track);
  }

  Log.info(
    "Queue updated",
    "",
    `guild=${guildId}`,
    `tracksAdded=${tracksToAdd.length}`,
    `startImmediately=${shouldStart}`,
    `queueLength=${player.queue.length}`
  );

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
