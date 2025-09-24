// const { Poru, Node, Track } = require("poru");
// const Log = require("./logs/log");
// const { errorEmbed } = require("./embeds");
// const { inspect } = require("util");
// const { info, clear } = require("console");

// const describeTrack = (track) => {
//   if (!track) return "unknown";
//   const info = track.info || {};
//   return `${info.title || info.identifier || "unknown"} [${info.identifier || "n/a"}]`;
// };

// const MAX_FALLBACK_ATTEMPTS = 1;
// const INACTIVITY_TIMEOUT_MS = Number(process.env.INACTIVITY_TIMEOUT_MS ?? 5 * 60 * 1000);

// const inactivityTimers = new Map();
// const playbackState = new Map();
// const TRACK_HISTORY_LIMIT = Number(process.env.TRACK_HISTORY_LIMIT ?? 20);
// const equalizerState = new Map();
// exports.equalizerState = equalizerState;

// const EQUALIZER_PRESETS = {
//   flat: [],
//   bass: [
//     { band: 0, gain: 0.25 }, { band: 1, gain: 0.20 }, { band: 2, gain: 0.15 },
//     { band: 3, gain: 0.10 }, { band: 4, gain: 0.05 }
//   ],
//   treble: [
//     { band: 9, gain: 0.05 }, { band: 10, gain: 0.10 }, { band: 11, gain: 0.15 },
//     { band: 12, gain: 0.20 }, { band: 13, gain: 0.25 }, { band: 14, gain: 0.30 }
//   ],
//   nightcore: [
//     { band: 0, gain: 0.05 }, { band: 1, gain: 0.05 }, { band: 2, gain: 0.05 },
//     { band: 3, gain: 0.05 }, { band: 4, gain: 0.05 }, { band: 5, gain: -0.05 }
//   ],
//   pop: [
//     { band: 0, gain: -0.05 }, { band: 1, gain: 0.10 }, { band: 2, gain: 0.15 },
//     { band: 3, gain: 0.20 }, { band: 4, gain: 0.12 }, { band: 5, gain: -0.05 },
//     { band: 6, gain: -0.10 }, { band: 9, gain: 0.08 }, { band: 10, gain: 0.12 }
//   ],
//   edm: [
//     { band: 0, gain: 0.22 }, { band: 1, gain: 0.20 }, { band: 2, gain: 0.18 },
//     { band: 5, gain: -0.08 }, { band: 7, gain: -0.10 }, { band: 9, gain: 0.15 },
//     { band: 10, gain: 0.20 }, { band: 11, gain: 0.22 }, { band: 12, gain: 0.18 }
//   ],
//   rock: [
//     { band: 0, gain: 0.18 }, { band: 1, gain: 0.12 }, { band: 3, gain: -0.06 },
//     { band: 4, gain: -0.10 }, { band: 5, gain: 0.05 }, { band: 7, gain: 0.12 },
//     { band: 8, gain: 0.15 }, { band: 10, gain: 0.15 }, { band: 11, gain: 0.12 }
//   ],
//   vocal: [
//     { band: 0, gain: -0.15 }, { band: 1, gain: -0.12 }, { band: 3, gain: 0.08 },
//     { band: 4, gain: 0.12 }, { band: 5, gain: 0.15 }, { band: 6, gain: 0.18 },
//     { band: 7, gain: 0.20 }, { band: 9, gain: 0.10 }
//   ],
//   podcast: [
//     { band: 0, gain: -0.20 }, { band: 1, gain: -0.15 }, { band: 2, gain: -0.08 },
//     { band: 4, gain: 0.10 }, { band: 5, gain: 0.12 }, { band: 6, gain: 0.15 }
//   ],
//   bassboost: [
//     { band: 0, gain: 0.30 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.20 },
//     { band: 3, gain: 0.12 }, { band: 4, gain: 0.08 }
//   ],
//   lofi: [
//     { band: 0, gain: 0.10 }, { band: 1, gain: 0.05 }, { band: 5, gain: -0.12 },
//     { band: 6, gain: -0.18 }, { band: 8, gain: -0.10 }, { band: 10, gain: 0.05 }
//   ]
// };
// exports.EQUALIZER_PRESETS = EQUALIZER_PRESETS;

// const ensurePlaybackState = (guildId) => {
//   const state = playbackState.get(guildId) || {};

//   if(!state.history) state.history = [];

//   playbackState.set(guildId, state);
//   return state;
// }

// const cloneTrack = (track) => {
//   if(!track) return null;

//   return {
//     ...track,
//     info: { ...(track.info || {}) },
//     pluginInfo: track.pluginInfo ? { ...(track.pluginInfo) } : undefined,
//     userData: track.userData ? { ...(track.userData) } : undefined,
//   }
// }

// const pushTrackHistory = (guildId, track) => {
//   if(!track.track) return;

//   const state = ensurePlaybackState(guildId);
//   const history = state.history;
//   history.push(cloneTrack(track));

//   if(TRACK_HISTORY_LIMIT > 0 && history.length > TRACK_HISTORY_LIMIT)
//   {
//     history.splice(0, history.length - TRACK_HISTORY_LIMIT);
//   }
// }

// let refreshNowPlayingMessageCached = null;
// const getRefreshHelper = () => {
//   if (!refreshNowPlayingMessageCached) {
//     ({ refreshNowPlayingMessage: refreshNowPlayingMessageCached } = require("./buttons"));
//   }
//   return refreshNowPlayingMessageCached;
// };

// const clearInactivityTimer = (guildId, reason = "unspecified") => {
//   const timer = inactivityTimers.get(guildId);
//   if (!timer) return;
  
//   clearTimeout(timer);
//   inactivityTimers.delete(guildId);
//   Log.info("Cleared inactivity timer", "", `guild=${guildId}`, `reason=${reason}`);
// };
// exports.clearInactivityTimer = clearInactivityTimer;

// const scheduleInactivityDisconnect = (player, reason = "queueEnd") => {
//   if (!INACTIVITY_TIMEOUT_MS || INACTIVITY_TIMEOUT_MS <= 0) return;
//   clearInactivityTimer(player.guildId);
//   const timeout = setTimeout(async () => {
//     inactivityTimers.delete(player.guildId);
//     try
//     {
//       const current = poru?.players.get(player.guildId);
      
//       if(!current) return;
//       if(current.isPlaying || current.queue.length > 0)
//       {
//         Log.info("Skipped inactivity disconnect (player active", "", `guild=${player.guildId}`);
//         return;
//       }

//       Log.info("Disconnecting due to inactivity", "", `guild=${player.guildId}`, `reason=${reason}`);
//       const channel = await poru.client.channels.fetch(current.textChannel).catch(() => null);

//       if(channel)
//       {
//         await channel.send("Disconnecting due to inactivity. Start playing a new track too bring me back.").catch(() => null);  
//       }

//       await current.destroy();
//       playbackState.delete(player.guildId);
//     }
//     catch(error)
//     {
//       const summary = error instanceof Error ? error.message : inspect(error, { depth: 1 });
//       Log.error("Failed to disconnect after inactivity", "", `guild=${player.guildId}`, `error=${summary}`);
//     }
//   }, INACTIVITY_TIMEOUT_MS);

//   timeout.unref?.();
//   inactivityTimers.set(player.guildId, timeout);
//   Log.info("Scheduled inactivity disconnect", "", `guild=${player.guildId}`, `timeoutMs=${INACTIVITY_TIMEOUT_MS}`, `reason=${reason}`);
// }

// const copyRequesterMetadata = (source = {}, target = {}) => {
//   ["requester", "requesterId", "requesterTag", "requesterAvatar", "loop"].forEach((key) => {
//     if (source[key] !== undefined) target[key] = source[key];
//   });
//   return target;
// };

// const buildFallbackQueries = (info = {}) => {
//   const seen = new Set();
//   const queries = [];
//   const push = (source, query) => {
//     const trimmed = (query || "").trim();
//     if (!trimmed) return;
//     const key = `${source}:${trimmed}`;
//     if (seen.has(key)) return;
//     seen.add(key);
//     queries.push({ source, query: trimmed });
//   };

//   const author = info.author && info.author !== "Unknown" ? info.author : "";
//   push("ytmsearch", [info.title, author].filter(Boolean).join(" "));
//   push("ytsearch", [info.title, author].filter(Boolean).join(" "));

//   if (info.identifier) {
//     push("ytmsearch", info.identifier);
//     push("ytsearch", info.identifier);
//   }

//   if (info.isrc) push("ytmsearch", info.isrc);

//   return queries;
// };

// async function tryQueueFallbackTrack(player, failedTrack) {
//   if (!failedTrack || !poru) return null;

//   const info = failedTrack.info || {};
//   failedTrack.userData = { ...(failedTrack.userData || {}) };
//   const previousAttempts = failedTrack.userData.fallbackAttempts || 0;

//   if (previousAttempts >= MAX_FALLBACK_ATTEMPTS) {
//     Log.warning(
//       "Fallback attempts exhausted",
//       "",
//       `guild=${player.guildId}`,
//       `track=${describeTrack(failedTrack)}`
//     );
//     return null;
//   }

//   const queries = buildFallbackQueries(info);
//   if (!queries.length) {
//     Log.warning(
//       "No fallback query candidates",
//       "",
//       `guild=${player.guildId}`,
//       `track=${describeTrack(failedTrack)}`
//     );
//     failedTrack.userData.fallbackAttempts = previousAttempts + 1;
//     return null;
//   }

//   for (const { source, query } of queries) {
//     try {
//       const response = await poru.resolve({ query, source });
//       const fallbackTrack = response?.tracks?.find((t) => t?.track);
//       if (!fallbackTrack) continue;

//       const fallbackInfo = copyRequesterMetadata(info, fallbackTrack.info || (fallbackTrack.info = {}));
//       if (fallbackInfo.identifier && info.identifier && fallbackInfo.identifier === info.identifier) continue;

//       fallbackTrack.userData = {
//         ...(fallbackTrack.userData || {}),
//         fallbackParent: describeTrack(failedTrack),
//         fallbackAttempts: previousAttempts + 1,
//       };

//       player.queue.unshift(fallbackTrack);
//       failedTrack.userData.fallbackAttempts = previousAttempts + 1;

//       Log.info(
//         "Queued fallback track",
//         "",
//         `guild=${player.guildId}`,
//         `from=${describeTrack(failedTrack)}`,
//         `to=${describeTrack(fallbackTrack)}`,
//         `source=${source}`
//       );

//       return fallbackTrack;
//     } catch (fallbackErr) {
//       const summary = fallbackErr instanceof Error ? fallbackErr.message : inspect(fallbackErr, { depth: 1 });
//       Log.warning(
//         "Fallback lookup failed",
//         "",
//         `guild=${player.guildId}`,
//         `query=${query}`,
//         `source=${source}`,
//         `error=${summary}`
//       );
//     }
//   }

//   failedTrack.userData.fallbackAttempts = previousAttempts + 1;
//   return null;
// }

// const PROGRESS_UPDATE_INTERVAL_MS = Number(process.env.PROGRESS_UPDATE_INTERVAL_MS ?? 10_000);

// const clearProgressInterval = (guildId) => {
//   const state = playbackState.get(guildId);
//   if (!state?.interval) return;
//   clearInterval(state.interval);
//   state.interval = null;
//   playbackState.set(guildId, state);
// };

// const scheduleProgressUpdates = (player) => {
//   if (!PROGRESS_UPDATE_INTERVAL_MS || PROGRESS_UPDATE_INTERVAL_MS <= 0) return;

//   clearProgressInterval(player.guildId);

//   const interval = setInterval(async () => {
//     const state = playbackState.get(player.guildId);
//     if (!state || !player.isPlaying || !player.currentTrack) return;

//     const info = player.currentTrack.info || {};
//     const length = info.length ?? Infinity;

//     const now = Date.now();
//     const lastPos = state.lastPosition ?? 0;
//     const lastTs = state.lastTimestamp ?? now;
//     const elapsed = Math.max(0, now - lastTs);
//     const estimated = Math.min(length, lastPos + (player.isPaused ? 0 : elapsed));

//     state.lastPosition = estimated;
//     state.lastTimestamp = now;
//     playbackState.set(player.guildId, state);

//     try 
//     {
//       const refresh = getRefreshHelper();
//       if (!refresh) return;

//       await refresh(player.poru.client, player.guildId, player, undefined, estimated);
//     } 
//     catch (err) 
//     {
//       clearProgressInterval(player.guildId); // stop if message vanished
//     }
//   }, PROGRESS_UPDATE_INTERVAL_MS);

//   interval.unref?.();
//   const state = playbackState.get(player.guildId) ?? {};
//   state.interval = interval;
//   playbackState.set(player.guildId, state);
// };

// let poru = null;

// function createPoru(client) {
//   if (poru) return poru;
//   const nodes = [
//     {
//       name: process.env.LAVALINK_NAME || "local",
//       host: process.env.LAVALINK_HOST || "127.0.0.1",
//       port: Number(process.env.LAVALINK_PORT || 2333),
//       password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
//       secure: process.env.LAVALINK_SECURE === "1",
//     },
//   ];

//   poru = new Poru(client, nodes, {
//     library: "discord.js",
//     defaultPlatform: "ytsearch",
//     reconnectTries: 5,
//     resumeKey: process.env.LAVALINK_RESUME_KEY || undefined,
//     resumeTimeout: 60,
//   });

//   poru.on("nodeConnect", (node) => Log.success(`Lavalink node connected ${node.name}`));

//   poru.on("trackError", async (player, track, err) => {
//     const errorSummary = err instanceof Error ? err.message : inspect(err, { depth: 1 });
//     Log.error(
//       "Lavalink track error",
//       "",
//       `guild=${player.guildId}`,
//       `track=${describeTrack(track)}`,
//       `queueLength=${player.queue.length}`,
//       `error=${errorSummary}`
//     );

//     const fallbackTrack = await tryQueueFallbackTrack(player, track);
//     const channel = await poru.client.channels.fetch(player.textChannel).catch(() => null);

//     if (fallbackTrack) {
//       if (channel) {
//         await channel.send({
//           embeds: [errorEmbed(
//             "Trying alternate source",
//             `The YouTube stream failed, so I'm retrying with an alternate source for **${fallbackTrack.info.title || fallbackTrack.info.identifier || "this track"}**.`
//           )],
//         }).catch(() => null);
//       }
//     } else if (channel) {
//       await channel.send({
//         embeds: [errorEmbed("Track unavailable", "YouTube blocked this track (age-restricted or region-locked).")],
//       }).catch(() => null);
//     }

//     if (!fallbackTrack && player.queue.length) {
//       Log.warning(
//         "Waiting for Lavalink auto-skip after error",
//         "",
//         `guild=${player.guildId}`,
//         `queueLength=${player.queue.length}`
//       );
//     }
//   });

//   poru.on("trackError", async (player, track, err) => {
//     const errorSummary = err instanceof Error ? err.message : inspect(err, { depth: 1 });
//     Log.error(
//       "Lavalink track error",
//       "",
//       `guild=${player.guildId}`,
//       `track=${describeTrack(track)}`,
//       `queueLength=${player.queue.length}`,
//       `error=${errorSummary}`
//     );

//     const channel = await poru.client.channels.fetch(player.textChannel).catch(() => null);
//     if (channel) {
//       await channel.send({
//         embeds: [errorEmbed("Track unavailable", "YouTube blocked this track (age-restricted or region-locked).")],
//       });
//     }

//     if (player.queue.length) {
//       Log.warning(
//         "Waiting for Lavalink auto-skip after error",
//         "",
//         `guild=${player.guildId}`,
//         `queueLength=${player.queue.length}`
//       );
//     }
//   });

//   poru.on("trackStart", (player, track) => {
//     clearInactivityTimer(player.guildId, "trackStart");
//     scheduleProgressUpdates(player);

//     const state = ensurePlaybackState(player.guildId);
//     state.currentTrack = cloneTrack(track);
//     state.lastPosition = 0;
//     state.lastTimestamp = Date.now();
//     playbackState.set(player.guildId, state);

//     Log.info(
//       "Lavalink track started",
//       "",
//       `guild=${player.guildId}`,
//       `track=${describeTrack(track)}`,
//       `queueLength=${player.queue.length}`
//     );
//   });

//   poru.on("trackEnd", (player, track, reason) => {
//     const reasonSummary = typeof reason === "string" ? reason : inspect(reason, { depth: 1 });
//     const nextTrack = player.currentTrack ? describeTrack(player.currentTrack) : "none";
//     Log.info(
//       "Lavalink track ended",
//       "",
//       `guild=${player.guildId}`,
//       `track=${describeTrack(track)}`,
//       `reason=${reasonSummary}`,
//       `queueLength=${player.queue.length}`,
//       `next=${nextTrack}`
//     );

//     clearProgressInterval(player.guildId);

//     if(!player.currentTrack && player.queue.length === 0)
//     {
//       scheduleInactivityDisconnect(player, "trackEnd");
//     }

//     const state = ensurePlaybackState(player.guildId);
//     const reasonCode = typeof reason === "string" ? reason : reason?.reason ?? null;

//     if(track?.track && reasonCode !== "replaced" && reasonCode !== "load_failed")
//     {
//       pushTrackHistory(player.guildId, track);
//     }

//     state.currentTrack = null;
//     playbackState.set(player.guildId, state);

//     if(player.queue.length === 0)
//     {
//       player.currentTrack = null;
//       player.isPlaying = false;
//       player.position = 0;
//     }

//     if(!player.currentTrack && player.queue.length === 0)
//     {
//       scheduleInactivityDisconnect(player, "trackEndEmpty");
//     }

//   });

//   poru.on("queueEnd", (player) => {
//     Log.info("Lavalink queue end", "", `guild=${player.guildId}`);

//     const state = ensurePlaybackState(player.guildId);
//     state.currentTrack = null;
//     playbackState.set(player.guildId, state);

//     player.currentTrack = null;
//     player.isPlaying = false;
//     player.isPaused = false;
//     player.position = 0;

//     scheduleInactivityDisconnect(player, "queueEnd");
//     clearProgressInterval(player.guildId);
//   });

//   poru.on("playerUpdate", (player) => {
//     const state = playbackState.get(player.guildId) ?? {};
//     state.lastPosition = player.position ?? 0;
//     state.lastTimestamp = Date.now();
//     playbackState.set(player.guildId, state);
//   })

//   return poru;
// }

// async function ensurePlayer(guildId, voiceId, textId) {
//   let player = poru.players.get(guildId);
  
//   if (player) return player;

//   player = await poru.createConnection({
//     guildId,
//     voiceChannel: voiceId,
//     textChannel: textId,
//     deaf: true,
//   });

//   const defaultVolume = Number(process.env.DEFAULT_VOLUME ?? 50);
//   const target = Number.isFinite(defaultVolume) ? Math.max(0, Math.min(defaultVolume, 1000)) : 50;
  
//   await player.setVolume(target);
//   player.volume = target;

//   return player;
// }

// async function lavalinkPlay({ guildId, voiceId, textId, query }) {
//   const player = await ensurePlayer(guildId, voiceId, textId);
//   let startImmediately = false;

//   let q = String(query || '').trim();
//   const isUrl = /^(https?:\/\/)/i.test(q);
//   if (!isUrl && q.toLowerCase().startsWith('ytsearch:')) {
//     q = q.slice('ytsearch:'.length);
//   }

//   const res = await poru.resolve({ query: isUrl ? q : q });
//   if (!res || !res.tracks || res.tracks.length === 0) throw new Error("No results found");

//   let tracksToAdd = [];
//   let nowPlaying = res.tracks[0];

//   if(res.loadType === 'playlist')
//   {
//     const selectedIndex = res.playlistInfo?.selectedTrack ?? 0;
//     nowPlaying = res.tracks[selectedIndex] ?? res.tracks[0];
//     tracksToAdd = res.tracks;
//   }
//   else
//   {
//     tracksToAdd = [nowPlaying]
//   }

//   for(const track of tracksToAdd)
//   {
//     track.info.requester = textId;
//     track.userData = {
//       ...(track.userData || {}),
//       fallbackAttempts: 0,
//     };
//     await player.queue.add(track);
//   }

//   const currentDescription = player.currentTrack ? describeTrack(player.currentTrack) : 'none';
//   Log.info(
//     "Playback state check",
//     "",
//     `guild=${guildId}`,
//     `isPlaying=${player.isPlaying}`,
//     `isPaused=${player.isPaused}`,
//     `current=${currentDescription}`,
//     `queueLength=${player.queue.length}`
//   );

//   if(!player.currentTrack && player.queue.length > 0)
//   {
//     await player.play();
//     startImmediately = true;
//   }

//   Log.info(
//     "Queue updated",
//     "",
//     `guild=${guildId}`,
//     `tracksAdded=${tracksToAdd.length}`,
//     `startImmediately=${startImmediately}`,
//     `queueLength=${player.queue.length}`
//   );

//   clearInactivityTimer(guildId, "playRequest");

//   return { track: nowPlaying, player, startImmediately };
// }

// async function lavalinkStop(guildId) {
//   const player = poru.players.get(guildId);
  
//   if(!player) return false;
  
//   player.queue.clear();
//   await player.destroy();
//   clearInactivityTimer(guildId, "stopCommand");
//   clearProgressInterval(guildId);
//   playbackState.delete(guildId);


//   return true;
// }

// async function lavalinkPause(guildId) {
//   const player = poru.players.get(guildId);
 
//   if (player && !player.isPaused) 
//   {
//     await player.pause(true);
//     clearInactivityTimer(guildId, "pauseCommand");
//     return true;
//   }
  
//   return false;
// }

// async function lavalinkResume(guildId) {
//   const player = poru.players.get(guildId);
 

//   if (player && player.isPaused) 
//   {
//     await player.pause(false);
//     clearInactivityTimer(guildId, "resumeCommand");
//     return true;
//   }

//   return false;
// }

// async function lavalinkSkip(guildId) {
//   const player = poru.players.get(guildId);
//   if (!player || (!player.currentTrack && player.queue.length === 0)) return false;

//   await player.skip();
//   if(!player.currentTrack && player.queue.length === 0)
//   {
//     scheduleInactivityDisconnect(player, "skipEmpty");
//   }
//   return true;
// }

// async function lavalinkPrevious(guildId)
// {
//   const player = getPlayer(guildId);
//   if(!player) return { status: "no_player" };

//   const state = ensurePlaybackState(guildId);
//   const history = state.history ?? [];

//   if(history.length === 0)
//   {
//     if(player.currentTrack)
//     {
//       await player.seekTo(0);
//       clearInactivityTimer(guildId, "previousRestart");
//       return { status: "restart", track: cloneTrack(player.currentTrack) };
//     }

//     return { status: "empty"};
//   }

//   const previous = history.pop();
//   const currentClone = cloneTrack(player.currentTrack);

//   if(currentClone?.track)
//   {
//     player.queue.unshift(currentClone);
//   }

//   clearProgressInterval(guildId);

//   await player.node.rest.updatePlayer({
//     guildId,
//     data: { track: { encoded: previous.track}, position: 0 }
//   })

//   player.currentTrack = cloneTrack(previous);
//   player.isPlaying = true;
//   player.isPaused = false;
//   player.position = 0;

//   state.history = history;
//   state.currentTrack = cloneTrack(previous);
//   state.lastPosition = 0;
//   state.lastTimestamp = Date.now();
//   playbackState.set(guildId, state);

//   clearInactivityTimer(guildId, "previousCommand");
//   scheduleProgressUpdates(player);

//   return { status: "previous", track: previous };
// }

// function getPlayer(guildId) { return poru?.players.get(guildId) ?? null; }
// exports.getPlayer = getPlayer;

// async function lavalinkToggleLoop(guildId, mode) {
//   const player = getPlayer(guildId);
  
//   if (!player) return null;

//   const next = mode && ['NONE','TRACK','QUEUE'].includes(mode)
//     ? mode
//     : player.loop === 'NONE' ? 'TRACK'
//     : player.loop === 'TRACK' ? 'QUEUE'
//     : 'NONE';

//   player.loop = next;
//   await player.setLoop(next);
//   clearInactivityTimer(guildId, 'toggleLoop');
//   return next;
// }

// async function lavalinkShuffle(guildId)
// {
//   const player = getPlayer(guildId);
  
//   if(!player || player.queue.length === 0) return false;
  
//   player.queue.shuffle();
//   clearInactivityTimer(guildId, "shuffle");
//   return true;
// }

// async function lavalinkClearQueue(guildId)
// {
//   const player = getPlayer(guildId);

//   if(!player || player.queue.length === 0) return false;

//   player.queue.clear();
//   clearInactivityTimer(guildId, "clearQueue");
//   return true;
// }

// async function lavalinkSetVolume(guildId, volume) 
// {
//   const player = getPlayer(guildId);

//   if (!player) return null;

//   const clamped = Math.max(0, Math.min(volume, 100));
//   await player.setVolume(clamped);
//   player.volume = clamped;
//   return clamped;
// }

// async function lavalinkGetVolume(guildId) 
// {
//   const player = getPlayer(guildId);
//   return player ? player.volume ?? 100 : null;
// }

// async function lavalinkSeekTo(guildId, positionMs)
// {
//   const player = getPlayer(guildId);

//   if (!player?.currentTrack) return false;

//   const rawLength = player.currentTrack.info?.length;
//   const maxLength = Number.isFinite(Number(rawLength)) ? Number(rawLength) : Number.POSITIVE_INFINITY;
//   const clamped = Math.max(0, Math.min(positionMs, maxLength));

//   await player.node.rest.updatePlayer({ guildId, data: { position: clamped } });
//   player.position = clamped;

//   const state = ensurePlaybackState(guildId);
//   state.lastPosition = clamped;
//   state.lastTimestamp = Date.now();
//   playbackState.set(guildId, state);

//   clearInactivityTimer(guildId, "seekTo");
//   return true;
// }

// async function lavalinkGetDuration(guildId)
// {
//   const player = getPlayer(guildId);
//   if (!player || !player.currentTrack) return null;

//   return player.currentTrack.info.length || null;
// }

// async function lavalinkSetEqualizer(guildId, presetOrBands)
// {
//   const player = getPlayer(guildId);

//   if(!player) return { status: "no_player" };

//   const normalize = (bands = []) =>
//     bands
//       .filter(Boolean)
//       .map(({ band, gain }) => ({
//         band: Number(band),
//         gain: Math.max(-0.25, Math.min(1, Number(gain)))
//       }))
//       .filter((b) => Number.isInteger(b.band) && b.band >= 0 && b.band <= 14);

//   const bands = Array.isArray(presetOrBands)
//     ? normalize(presetOrBands)
//     : normalize(EQUALIZER_PRESETS[presetOrBands?.toLowerCase()] ?? []);

//   if(!bands.length && presetOrBands && !EQUALIZER_PRESETS[presetOrBands?.toLowerCase()]) return { status: "invalid_preset" };

//   const current = equalizerState.get(guildId) ?? {};
//   const nextFilters = {
//     ...current,
//     equalizer: bands
//   }

//   await player.node.rest.updatePlayer({
//     guildId,
//     data: { filters: nextFilters }
//   })

//   equalizerState.set(guildId, nextFilters);
//   player.filters = nextFilters;
//   clearInactivityTimer(guildId, "setEqualizer");

//   return { status: "ok", filters: nextFilters };
// }

// async function lavalinkResetFilters(guildId)
// {
//   const player = getPlayer(guildId);

//   if(!player) return { status: "no_player" };

//   const baseline = { ...(player.filters ?? {}) };
//   delete baseline.equalizer;

//   await player.node.rest.updatePlayer({
//     guildId,
//     data: { filters: { ...baseline, equalizer: [] } }
//   });

//   equalizerState.set(guildId, { ...baseline, equalizer: []} );
//   player.filters = { ...baseline, equalizer: [] };
//   clearInactivityTimer(guildId, "resetFilters");

//   return { status: "ok" };
  
// }

// module.exports = { 
//   createPoru, 
//   lavalinkPlay, 
//   lavalinkStop, 
//   lavalinkPause, 
//   lavalinkResume, 
//   lavalinkSkip, 
//   lavalinkToggleLoop, 
//   lavalinkShuffle, 
//   lavalinkSetVolume, 
//   lavalinkGetVolume, 
//   lavalinkSeekTo, 
//   lavalinkClearQueue, 
//   lavalinkGetDuration,
//   lavalinkPrevious,
//   lavalinkSetEqualizer,
//   lavalinkResetFilters,
// };



