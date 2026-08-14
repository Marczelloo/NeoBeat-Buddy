const http = require("node:http");
const { URL } = require("node:url");
const { WebSocketServer } = require("ws");

const djStore = require("../dj/store");
const { getUserPresets } = require("../equalizer/customPresets");
const EQ_PRESET_NAMES = require("../equalizer/presets");
const guildState = require("../guildState");
const { EQUALIZER_PRESETS } = require("../lavalink/constants");
const { getEqualizerState } = require("../lavalink/equalizerStore");
const { getFilterPreset, FILTER_PRESET_NAMES } = require("../lavalink/filterPresets");
const {
  getPlayer,
  lavalinkClearQueue,
  lavalinkPause,
  lavalinkPlay,
  lavalinkPrevious,
  lavalinkRemoveFromQueue,
  lavalinkResume,
  lavalinkSeekTo,
  lavalinkSetEqualizer,
  lavalinkResetEffects,
  lavalinkSetFilterPreset,
  lavalinkSetVolume,
  lavalinkShuffle,
  lavalinkSkip,
  lavalinkStop,
  lavalinkToggleLoop,
} = require("../lavalink/index");
const { getUserVolume } = require("../lavalink/loudness");
const { fetchLyrics } = require("../lavalink/lyricsClient");
const { getInterpolatedPosition, stopLyricsSession } = require("../lavalink/lyricsFormatter");
const { getPoru } = require("../lavalink/players");
const { searchSingleSource } = require("../lavalink/searchAggregator");
const { filterPlayableSearchResults, rankSearchResults } = require("../lavalink/searchRanking");
const { skipWithLearning } = require("../lavalink/skipLearning");
const { getLyricsState, playbackState, setLyricsState } = require("../lavalink/state");
const Log = require("../logs/log");
const { importPlaylistFromUrl } = require("../playlists/import");
const playlistStore = require("../playlists/store");
const { serializeFilters, serializeLyrics, serializePlaylist, serializePlaylistDetails, serializeTrack, normalizeSource } = require("./state");
const { activityStateEvents, getActivityStateRevision, markActivityStateChanged } = require("./sync");

const DEFAULT_PORT = 8787;
const MAX_BODY_SIZE = 64 * 1024;
const MAX_ARTWORK_SIZE = 8 * 1024 * 1024;
const CLIENT_CACHE_TTL = 5 * 60 * 1000;
const ARTWORK_HOSTS = Object.freeze([
  "dzcdn.net",
  "sndcdn.com",
  "scdn.co",
  "spotifycdn.com",
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
  "img.youtube.com",
  "discordapp.com",
  "discordapp.net",
  "imgur.com",
  "picsum.photos",
]);
const identityCache = new Map();
const sockets = new Set();

function isTrue(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function getActivityConfig() {
  return {
    enabled: !["0", "false", "off", "no"].includes(String(process.env.ACTIVITY_ENABLED ?? "true").toLowerCase()),
    host: process.env.ACTIVITY_HOST || "127.0.0.1",
    port: Number(process.env.ACTIVITY_PORT || DEFAULT_PORT),
    allowDev: isTrue(process.env.ACTIVITY_ALLOW_DEV),
    devGuildId: process.env.ACTIVITY_DEV_GUILD_ID || "demo",
    devUserId: process.env.ACTIVITY_DEV_USER_ID || "local-user",
    clientSecret: process.env.ACTIVITY_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.ACTIVITY_REDIRECT_URI || "https://127.0.0.1",
    allowedOrigins: String(process.env.ACTIVITY_ALLOWED_ORIGINS || "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

function stringifyJson(payload) {
  const seen = new WeakSet();
  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value;
  });
}

function sendJson(response, statusCode, payload, config) {
  const serializedPayload = stringifyJson(payload);
  const requestedOrigin = response.req?.headers?.origin;
  const allowOrigin = config.allowedOrigins.includes("*")
    ? "*"
    : config.allowedOrigins.includes(requestedOrigin)
      ? requestedOrigin
      : config.allowedOrigins[0] || "null";

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(serializedPayload);
}

function isAllowedArtworkUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    const configuredHosts = String(process.env.ACTIVITY_ARTWORK_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    return [...ARTWORK_HOSTS, ...configuredHosts].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

async function sendArtwork(response, sourceUrl) {
  if (!isAllowedArtworkUrl(sourceUrl)) {
    throw Object.assign(new Error("That artwork host is not allowed."), { statusCode: 400 });
  }

  let currentUrl = sourceUrl;
  let artworkResponse = null;

  for (let redirect = 0; redirect < 4; redirect += 1) {
    artworkResponse = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "User-Agent": "MewBit-Activity/1.1",
      },
    });

    if (artworkResponse.status < 300 || artworkResponse.status >= 400) break;
    const location = artworkResponse.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, currentUrl).toString();
    if (!isAllowedArtworkUrl(currentUrl)) {
      throw Object.assign(new Error("Artwork redirect host is not allowed."), { statusCode: 400 });
    }
  }

  if (!artworkResponse?.ok) {
    throw Object.assign(new Error("Artwork provider did not return an image."), { statusCode: 502 });
  }

  const contentType = String(artworkResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const contentLength = Number(artworkResponse.headers.get("content-length") || 0);
  if (!contentType.startsWith("image/") || contentLength > MAX_ARTWORK_SIZE) {
    throw Object.assign(new Error("Artwork response is invalid or too large."), { statusCode: 502 });
  }

  const body = Buffer.from(await artworkResponse.arrayBuffer());
  if (body.length > MAX_ARTWORK_SIZE) {
    throw Object.assign(new Error("Artwork response is too large."), { statusCode: 502 });
  }

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function getBearerToken(request) {
  const header = String(request.headers.authorization || "");
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}

function getIdentityFromDev(config, guildId, token) {
  if (!config.allowDev) return null;
  if (guildId !== config.devGuildId) return null;
  if (process.env.ACTIVITY_DEV_TOKEN && token !== process.env.ACTIVITY_DEV_TOKEN) return null;

  return {
    id: config.devUserId,
    username: "Local Listener",
    tag: "Local Listener",
    member: null,
    dev: true,
  };
}

async function fetchDiscordUser(token) {
  const cached = identityCache.get(token);
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) return cached.identity;

  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Discord authentication expired. Reopen the Activity.");

  const user = await response.json();
  const identity = {
    id: user.id,
    username: user.global_name || user.username || "Discord user",
    tag: user.discriminator && user.discriminator !== "0" ? `${user.username}#${user.discriminator}` : user.username,
    avatar: user.avatar || null,
    member: null,
    dev: false,
  };
  identityCache.set(token, { timestamp: Date.now(), identity });
  return identity;
}

async function authenticateRequest(client, request, guildId, config) {
  const token = getBearerToken(request);
  const devIdentity = getIdentityFromDev(config, guildId, token);
  if (devIdentity) return devIdentity;
  if (!token) throw Object.assign(new Error("Activity authentication is required."), { statusCode: 401 });

  const identity = await fetchDiscordUser(token);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw Object.assign(new Error("The bot is not connected to this Discord server."), { statusCode: 404 });

  try {
    identity.member = await guild.members.fetch(identity.id);
  } catch {
    throw Object.assign(new Error("You are not a member of this Discord server."), { statusCode: 403 });
  }

  return identity;
}

function assertControlPermission(guildId, identity, action) {
  if (identity.dev) return;

  const config = djStore.getGuildConfig(guildId);
  if (!config.enabled) return;
  if (djStore.hasDjPermissions(identity.member, config)) return;

  const guardedActions = new Set([
    "pause",
    "resume",
    "toggle",
    "skip",
    "previous",
    "stop",
    "remove_queue",
    "move_queue",
    "clear_queue",
    "shuffle",
    "volume",
    "seek",
    "filter",
    "equalizer",
    "loop",
    "autoplay",
    "play",
  ]);

  if (guardedActions.has(action)) {
    throw Object.assign(new Error("DJ mode is enabled. This control is limited to DJs."), { statusCode: 403 });
  }
}

function getVoiceChannelName(client, player) {
  if (!player) return null;
  return client.guilds.cache.get(player.guildId)?.channels.cache.get(player.voiceChannel)?.name || null;
}

function getSerializedQueue(player) {
  return Array.from(player?.queue || []).map((track, index) => serializeTrack(track, index));
}

function getSerializedPlaylists(userId, guildId) {
  if (!userId) return [];
  return playlistStore.listPlaylists(userId, guildId).map(serializePlaylist);
}

function getSerializedEqualizerPresets(userId) {
  const builtIn = EQ_PRESET_NAMES.map((name) => ({
    name,
    custom: false,
    bands: EQUALIZER_PRESETS[name] || [],
  }));
  const custom = Object.values(getUserPresets(userId) || {}).map((preset) => ({
    name: preset.name,
    custom: true,
    bands: Array.isArray(preset.bands) ? preset.bands : [],
  }));
  return [...builtIn, ...custom];
}

function buildActivityState(client, guildId, userId) {
  const player = getPlayer(guildId);
  const likedSongs = playlistStore.getLikedSongs(userId);
  const livePlaybackState = playbackState.get(guildId);
  const playback = resolveActivityPlayback(livePlaybackState?.currentTrack, player?.currentTrack);
  const currentTrack = playback.track ? serializeTrack(playback.track) : null;
  const filters = getEqualizerState(guildId) || player?.filters || {};
  const guild = client.guilds.cache.get(guildId);
  const settings = guildState.getGuildState(guildId);
  const lyrics = serializeLyrics(getLyricsState(guildId));
  const position = playback.usesPlayerTrack ? getInterpolatedPosition(player, Date.now(), 0) : 0;
  const botStatus = client?.user?.presence?.activities?.find((activity) => activity.type === 2)?.name || null;

  const generatedAt = Date.now();

  return {
    revision: getActivityStateRevision(guildId),
    generatedAt,
    botStatus,
    guild: {
      id: guildId,
      name: guild?.name || "Local MewBit preview",
      iconUrl: guild?.iconURL?.({ size: 128 }) || null,
      voiceChannelName: getVoiceChannelName(client, player),
    },
    player: {
      connected: Boolean(player),
      paused: Boolean(player?.isPaused),
      playing: Boolean(player?.isPlaying && !player?.isPaused),
      positionMs: Math.max(0, Math.round(position)),
      durationMs: playback.durationMs || currentTrack?.durationMs || 0,
      volume: getUserVolume(player),
      loop: player?.loop || "NONE",
      shuffleActive: Boolean(player?.shuffleActive),
      autoplay: Boolean(settings?.autoplay),
      currentTrack,
      queue: getSerializedQueue(player),
      filters: serializeFilters(filters),
      lyrics,
      updatedAt: generatedAt,
    },
    playlists: getSerializedPlaylists(userId, guildId),
    likedTrackIds: [...new Set((likedSongs.tracks || []).flatMap((track) => playlistStore.getTrackIdentityKeys(track)))],
    filterPresets: FILTER_PRESET_NAMES,
    equalizerPresets: getSerializedEqualizerPresets(userId),
  };
}

function resolveActivityPlayback(stateTrack, playerTrack) {
  // Poru's player is the source of truth for the active stream. The state
  // snapshot is intentionally only a fallback while a player is unavailable.
  const usesPlayerTrack = Boolean(playerTrack);
  const track = usesPlayerTrack ? playerTrack : stateTrack || playerTrack || null;
  const playerDuration = Number(playerTrack?.info?.length) || 0;

  return {
    track,
    usesPlayerTrack,
    durationMs: usesPlayerTrack ? playerDuration : Number(track?.info?.length) || 0,
  };
}

function limitText(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function toSource(value) {
  return ["auto", "deezer", "youtube", "spotify", "soundcloud"].includes(value) ? value : "auto";
}

function serializeActivitySearchResults(tracks, query) {
  return rankSearchResults(filterPlayableSearchResults(tracks, query), query, { limit: 48 }).map((track) => {
    const serialized = serializeTrack(track);
    return {
      ...serialized,
      playQuery: serialized.uri || `${serialized.title} ${serialized.author}`,
    };
  });
}

function serializeActivityActionResult(action, result) {
  if (action === "play") {
    return {
      success: true,
      track: result?.track ? serializeTrack(result.track) : null,
      isPlaylist: Boolean(result?.isPlaylist),
      playlistTrackCount: Number(result?.playlistTrackCount) || 0,
    };
  }
  if (action === "refresh_lyrics") return result ? serializeLyrics(result) : null;
  return result;
}

async function runActivityAction({ guildId, identity, action, payload = {} }) {
  assertControlPermission(guildId, identity, action);
  const player = getPlayer(guildId);

  switch (action) {
    case "play": {
      const query = limitText(payload.query, 500);
      if (!query) throw Object.assign(new Error("Choose a track or enter a search query."), { statusCode: 400 });
      const settings = guildState.getGuildState(guildId);
      const memberVoice = identity.member?.voice?.channelId;
      const voiceId = player?.voiceChannel || memberVoice;
      const textId = settings?.playerChannel || player?.textChannel || null;
      if (!voiceId) throw Object.assign(new Error("Join a voice channel before starting playback."), { statusCode: 400 });
      if (!textId) throw Object.assign(new Error("Set the player channel first with /setup player channel."), { statusCode: 400 });
      if (player && player.textChannel !== textId) player.textChannel = textId;
      if (settings?.playerChannel) guildState.updateGuildState(guildId, { nowPlayingChannel: textId });

      return lavalinkPlay({
        guildId,
        voiceId,
        textId,
        query,
        source: toSource(payload.source),
        prepend: Boolean(payload.prepend),
        playNow: Boolean(payload.playNow),
        requester: {
          id: identity.id,
          tag: identity.tag || identity.username,
          avatar: identity.avatar,
        },
      });
    }
    case "pause":
      return lavalinkPause(guildId);
    case "resume":
      return lavalinkResume(guildId);
    case "toggle":
      return player?.isPaused ? lavalinkResume(guildId) : lavalinkPause(guildId);
    case "skip":
      if (payload.expectedTrackId) {
        const liveTrack = playbackState.get(guildId)?.currentTrack || player?.currentTrack || null;
        const liveTrackId = liveTrack ? serializeTrack(liveTrack)?.id : null;
        if (!liveTrackId || String(payload.expectedTrackId) !== String(liveTrackId)) {
          return {
            success: false,
            stale: true,
            error: "The player already moved to the next track. Synced the latest state instead.",
          };
        }
      }
      return skipWithLearning(guildId, player, lavalinkSkip, "activity_skip");
    case "previous":
      return lavalinkPrevious(guildId);
    case "stop":
      return lavalinkStop(guildId);
    case "seek":
      return lavalinkSeekTo(guildId, Math.max(0, Number(payload.positionMs) || 0));
    case "volume":
      return lavalinkSetVolume(guildId, Math.max(0, Math.min(100, Number(payload.volume) || 0)));
    case "loop":
      return lavalinkToggleLoop(guildId, payload.mode);
    case "shuffle":
      return lavalinkShuffle(guildId);
    case "clear_queue":
      return lavalinkClearQueue(guildId);
    case "remove_queue":
      return lavalinkRemoveFromQueue(guildId, { position: Number(payload.position) + 1 });
    case "move_queue": {
      if (!player?.queue) return false;
      const from = Number(payload.from);
      const to = Number(payload.to);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= player.queue.length || to >= player.queue.length) {
        throw Object.assign(new Error("That queue position is no longer available."), { statusCode: 409 });
      }
      const [track] = player.queue.splice(from, 1);
      player.queue.splice(to, 0, track);
      return true;
    }
    case "filter":
      if (String(payload.preset || "").toLowerCase() === "off") return lavalinkResetEffects(guildId);
      if (!getFilterPreset(payload.preset)) throw Object.assign(new Error("Unknown filter preset."), { statusCode: 400 });
      return lavalinkSetFilterPreset(guildId, payload.preset);
    case "equalizer":
      return lavalinkSetEqualizer(guildId, Array.isArray(payload.bands) ? payload.bands : []);
    case "equalizer_preset": {
      const presetName = limitText(payload.preset, 80).toLowerCase();
      const customPresets = getUserPresets(identity.id) || {};
      const customKey = Object.keys(customPresets).find((key) => key.toLowerCase() === presetName);
      const customPreset = customKey ? customPresets[customKey] : null;
      if (customPreset) return lavalinkSetEqualizer(guildId, customPreset.bands);
      if (!EQ_PRESET_NAMES.includes(presetName)) throw Object.assign(new Error("Unknown equalizer preset."), { statusCode: 400 });
      return lavalinkSetEqualizer(guildId, presetName);
    }
    case "autoplay":
      return guildState.updateGuildState(guildId, { autoplay: Boolean(payload.enabled) });
    case "refresh_lyrics": {
      if (!player?.currentTrack) return null;
      await stopLyricsSession(guildId, { deleteMessage: false });
      const lyrics = await fetchLyrics(player, player.currentTrack.info).catch(() => null);
      setLyricsState(guildId, lyrics);
      return lyrics;
    }
    case "get_playlist": {
      const playlist = playlistStore.getPlaylist(identity.id, guildId, limitText(payload.name, 80));
      if (!playlist) throw Object.assign(new Error("Playlist not found."), { statusCode: 404 });
      return { playlist: serializePlaylistDetails(playlist) };
    }
    case "create_playlist":
      return playlistStore.createPlaylist(identity.id, guildId, limitText(payload.name, 80), {
        description: limitText(payload.description, 180),
        public: Boolean(payload.public),
        collaborative: Boolean(payload.collaborative),
        type: payload.type === "server" ? "server" : "user",
      });
    case "add_to_playlist": {
      const track = payload.track || player?.currentTrack;
      if (!track) throw Object.assign(new Error("Choose a track to save."), { statusCode: 400 });
      return playlistStore.addTrack(identity.id, guildId, limitText(payload.name, 80), track);
    }
    case "toggle_like": {
      const track = payload.track || player?.currentTrack;
      if (!track) throw Object.assign(new Error("Choose a track to like."), { statusCode: 400 });
      const liked = playlistStore.getLikedSongs(identity.id);
      const existing = playlistStore.isTrackInPlaylist(identity.id, guildId, liked.name, track);
      if (existing.exists) {
        return { ...playlistStore.removeTrack(identity.id, guildId, liked.name, existing.position), liked: false };
      }
      return { ...playlistStore.addTrack(identity.id, guildId, liked.name, track), liked: true };
    }
    case "delete_playlist":
      return playlistStore.deletePlaylist(identity.id, guildId, limitText(payload.name, 80));
    case "rename_playlist":
      return playlistStore.renamePlaylist(identity.id, guildId, limitText(payload.name, 80), limitText(payload.newName, 80));
    case "edit_playlist":
      return playlistStore.editPlaylist(identity.id, guildId, limitText(payload.name, 80), {
        description: payload.description === undefined ? undefined : limitText(payload.description, 240),
        thumbnail: payload.thumbnail === undefined ? undefined : limitText(payload.thumbnail, 500),
        public: payload.public === undefined ? undefined : Boolean(payload.public),
        collaborative: payload.collaborative === undefined ? undefined : Boolean(payload.collaborative),
      });
    case "update_playlist": {
      const oldName = limitText(payload.name, 80);
      const newName = limitText(payload.newName, 80);
      if (newName && newName.toLowerCase() !== oldName.toLowerCase()) {
        const renamed = playlistStore.renamePlaylist(identity.id, guildId, oldName, newName);
        if (!renamed.success) return renamed;
      }
      const result = playlistStore.editPlaylist(identity.id, guildId, newName || oldName, {
        description: payload.description === undefined ? undefined : limitText(payload.description, 240),
        thumbnail: payload.thumbnail === undefined ? undefined : limitText(payload.thumbnail, 500),
        public: payload.public === undefined ? undefined : Boolean(payload.public),
        collaborative: payload.collaborative === undefined ? undefined : Boolean(payload.collaborative),
      });
      if (result.success) {
        const playlist = playlistStore.getPlaylist(identity.id, guildId, newName || oldName);
        return { ...result, playlist: playlist ? serializePlaylistDetails(playlist) : null };
      }
      return result;
    }
    case "remove_playlist_track":
      return playlistStore.removeTrack(identity.id, guildId, limitText(payload.name, 80), Number(payload.position) + 1);
    case "move_playlist_track":
      return playlistStore.moveTrack(identity.id, guildId, limitText(payload.name, 80), Number(payload.from) + 1, Number(payload.to) + 1);
    case "import_playlist": {
      const url = limitText(payload.url, 1000);
      if (!url) throw Object.assign(new Error("Paste a playlist URL first."), { statusCode: 400 });
      return importPlaylistFromUrl(null, identity.id, guildId, url, {
        name: limitText(payload.name, 80) || undefined,
        description: limitText(payload.description, 240) || undefined,
        type: payload.type === "server" ? "server" : "user",
        public: Boolean(payload.public),
        collaborative: Boolean(payload.collaborative),
      });
    }
    case "play_playlist": {
      const playlist = playlistStore.getPlaylist(identity.id, guildId, limitText(payload.name, 80));
      if (!playlist?.tracks?.length) throw Object.assign(new Error("That playlist is empty or unavailable."), { statusCode: 404 });
      const voiceId = player?.voiceChannel || identity.member?.voice?.channelId;
      const settings = guildState.getGuildState(guildId);
      const textId = settings?.playerChannel || player?.textChannel || null;
      if (!voiceId) throw Object.assign(new Error("Join a voice channel before playing a playlist."), { statusCode: 400 });
      if (!textId) throw Object.assign(new Error("Set the player channel first with /setup player channel."), { statusCode: 400 });
      if (player && player.textChannel !== textId) player.textChannel = textId;
      if (settings?.playerChannel) guildState.updateGuildState(guildId, { nowPlayingChannel: textId });

      const tracks = [...playlist.tracks.slice(0, 100)];
      if (payload.shuffle) tracks.sort(() => Math.random() - 0.5);
      for (const track of tracks) {
        const query = track.uri || `${track.title} ${track.author}`;
        await lavalinkPlay({
          guildId,
          voiceId,
          textId,
          query,
          source: normalizeSource(track.source || track.uri),
          requester: { id: identity.id, tag: identity.tag || identity.username, avatar: identity.avatar },
        });
      }
      return { count: tracks.length, shuffled: Boolean(payload.shuffle) };
    }
    default:
      throw Object.assign(new Error(`Unknown Activity action: ${action}`), { statusCode: 400 });
  }
}

async function searchActivityTracks(query, preferredSource) {
  const poru = getPoru();
  if (!poru) throw Object.assign(new Error("Lavalink is still connecting."), { statusCode: 503 });

  const selectedSource = toSource(preferredSource);
  const sources = selectedSource === "auto"
    ? ["youtube", "soundcloud", "deezer", "spotify"]
    : [selectedSource];
  let firstNonEmpty = [];

  for (const source of sources) {
    const tracks = await searchSingleSource(poru, limitText(query, 200), source);
    if (!firstNonEmpty.length && tracks.length) firstNonEmpty = tracks;

    const relevant = filterPlayableSearchResults(tracks, query);
    if (relevant.length) return serializeActivitySearchResults(relevant, query);
  }

  // An explicitly selected provider should still be allowed to show its best
  // available matches. Auto mode reaches this only after every fallback has
  // failed to produce a real match.
  return serializeActivitySearchResults(filterPlayableSearchResults(firstNonEmpty, query), query);
}

function sendSocket(socket, payload) {
  if (socket.readyState === 1) socket.send(stringifyJson(payload));
}

function broadcastGuildState(client, guildId) {
  for (const socket of sockets) {
    if (socket.readyState !== 1 || !socket.authorized || socket.guildId !== guildId) continue;
    sendSocket(socket, { type: "state", state: buildActivityState(client, guildId, socket.identity.id) });
  }
}

function createActivityServer(client) {
  const config = getActivityConfig();
  let server = null;
  let interval = null;
  let listeningForPlayerChanges = false;

  const handlePlayerStateChange = ({ guildId }) => broadcastGuildState(client, guildId);

  async function handleRequest(request, response) {
    response.req = request;
    if (request.method === "OPTIONS") return sendJson(response, 204, null, config);

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    try {
      if (request.method === "POST" && url.pathname === "/api/token") {
        if (!config.clientSecret) throw Object.assign(new Error("DISCORD_CLIENT_SECRET is not configured on the Activity gateway."), { statusCode: 503 });
        const body = await readJson(request);
        if (!body.code) throw Object.assign(new Error("Missing Discord authorization code."), { statusCode: 400 });
        const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: config.clientSecret,
            grant_type: "authorization_code",
            code: body.code,
          }),
        });
        const tokenPayload = await tokenResponse.json();
        if (!tokenResponse.ok) {
          const detail = [tokenPayload.error, tokenPayload.error_description].filter(Boolean).join(": ") || "Discord token exchange failed.";
          Log.error("Discord OAuth token exchange rejected", `status=${tokenResponse.status} ${detail}`);
          throw Object.assign(new Error(detail), { statusCode: 502 });
        }
        return sendJson(response, 200, tokenPayload, config);
      }

      if (request.method === "GET" && url.pathname === "/api/activity/health") {
        return sendJson(response, 200, { ok: true, activity: "mewbit", time: Date.now() }, config);
      }

      if (request.method === "GET" && url.pathname === "/api/activity/artwork") {
        return await sendArtwork(response, url.searchParams.get("url") || "");
      }

      if (url.pathname === "/api/activity/state" && request.method === "GET") {
        const guildId = url.searchParams.get("guildId") || config.devGuildId;
        const identity = await authenticateRequest(client, request, guildId, config);
        return sendJson(response, 200, { ok: true, state: buildActivityState(client, guildId, identity.id), identity: { id: identity.id, username: identity.username } }, config);
      }

      if (url.pathname === "/api/activity/search" && request.method === "POST") {
        const body = await readJson(request);
        const guildId = limitText(body.guildId || config.devGuildId, 80);
        await authenticateRequest(client, request, guildId, config);
        const tracks = await searchActivityTracks(body.query, body.source);
        return sendJson(response, 200, { ok: true, tracks }, config);
      }

      if (url.pathname === "/api/activity/action" && request.method === "POST") {
        const body = await readJson(request);
        const guildId = limitText(body.guildId || config.devGuildId, 80);
        const identity = await authenticateRequest(client, request, guildId, config);
        let result = await runActivityAction({ guildId, identity, action: body.action, payload: body.payload || {} });
        const actionPayload = body.payload || {};
        const detailName = actionPayload.newName || actionPayload.name || result?.playlistName;
        const detailActions = new Set([
          "create_playlist",
          "add_to_playlist",
          "get_playlist",
          "edit_playlist",
          "update_playlist",
          "remove_playlist_track",
          "move_playlist_track",
          "import_playlist",
        ]);
        if (detailActions.has(body.action) && detailName) {
          const playlist = playlistStore.getPlaylist(identity.id, guildId, detailName);
          if (playlist) result = { ...result, playlist: serializePlaylistDetails(playlist) };
        }
        markActivityStateChanged(guildId, `activity:${body.action}`);
        return sendJson(response, 200, { ok: true, result: serializeActivityActionResult(body.action, result), state: buildActivityState(client, guildId, identity.id) }, config);
      }

      return sendJson(response, 404, { ok: false, error: "Not found" }, config);
    } catch (error) {
      const status = Number(error.statusCode) || 500;
      if (status >= 500) Log.error("Activity gateway request failed", error, `path=${url.pathname}`);
      return sendJson(response, status, { ok: false, error: error.message || "Activity gateway error" }, config);
    }
  }

  function handleUpgrade(request, socket, head) {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname !== "/api/activity/ws") return socket.destroy();
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => webSocketServer.emit("connection", webSocket, request));
  }

  const webSocketServer = new WebSocketServer({ noServer: true });
  webSocketServer.on("connection", (socket) => {
    socket.authorized = false;
    sockets.add(socket);

    socket.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "auth") {
          const fakeRequest = { headers: { authorization: message.token ? `Bearer ${message.token}` : "" } };
          const guildId = limitText(message.guildId || config.devGuildId, 80);
          socket.identity = await authenticateRequest(client, fakeRequest, guildId, config);
          socket.guildId = guildId;
          socket.authorized = true;
          sendSocket(socket, { type: "ready", identity: { id: socket.identity.id, username: socket.identity.username } });
          sendSocket(socket, { type: "state", state: buildActivityState(client, guildId, socket.identity.id) });
          return;
        }
        if (!socket.authorized) return sendSocket(socket, { type: "error", error: "Authenticate the Activity socket first." });
        if (message.type === "action") {
          await runActivityAction({ guildId: socket.guildId, identity: socket.identity, action: message.action, payload: message.payload || {} });
          markActivityStateChanged(socket.guildId, `activity:${message.action}`);
        }
      } catch (error) {
        sendSocket(socket, { type: "error", error: error.message || "Activity socket error" });
      }
    });

    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => sockets.delete(socket));
  });

  return {
    start() {
      if (!config.enabled) {
        Log.info("MewBit Activity gateway disabled", "set ACTIVITY_ENABLED=true to enable");
        return null;
      }

      server = http.createServer(handleRequest);
      server.on("upgrade", handleUpgrade);
      server.on("error", (error) => Log.error("MewBit Activity gateway error", error));
      server.listen(config.port, config.host, () => {
        const actualPort = server.address()?.port || config.port;
        Log.success("MewBit Activity gateway ready", `http://${config.host}:${actualPort}`);
      });
      if (!listeningForPlayerChanges) {
        activityStateEvents.on("change", handlePlayerStateChange);
        listeningForPlayerChanges = true;
      }
      interval = setInterval(() => {
        const guilds = new Set([...sockets].filter((socket) => socket.authorized).map((socket) => socket.guildId));
        for (const guildId of guilds) broadcastGuildState(client, guildId);
      }, 1000);
      interval.unref?.();
      return server;
    },
    stop() {
      if (interval) clearInterval(interval);
      interval = null;
      if (listeningForPlayerChanges) {
        activityStateEvents.off("change", handlePlayerStateChange);
        listeningForPlayerChanges = false;
      }
      for (const socket of sockets) socket.close();
      sockets.clear();
      if (server) server.close();
      server = null;
    },
  };
}

module.exports = {
  createActivityServer,
  buildActivityState,
  resolveActivityPlayback,
  isAllowedArtworkUrl,
  runActivityAction,
  searchActivityTracks,
  serializeActivityActionResult,
  stringifyJson,
};
