const djStore = require("../dj/store");
const { getGuildState, updateGuildState } = require("../guildState");
const { EQUALIZER_PRESETS } = require("../lavalink/constants");
const { getEqualizerState, setEqualizerState } = require("../lavalink/equalizerStore");
const { buildEqualizerFilters, lavalinkSetEqualizer, SAFE_EQ_MIN_GAIN, SAFE_EQ_MAX_GAIN } = require("../lavalink/filters");
const Log = require("../logs/log");
const statsStore = require("../stats/store");

const SOURCES = Object.freeze(["deezer", "youtube", "spotify", "soundcloud"]);
const SKIP_MODES = Object.freeze(["dj", "vote", "hybrid"]);
const LOG_CATEGORY_KEYS = Object.freeze(["message", "voice", "server", "bot"]);
const EQ_BAND_COUNT = 15;
const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const SNOWFLAKE = /^\d{5,25}$/;

/* The command modules own these two stores and are already required this way
   by the event handlers, so the dashboard reads them there rather than keeping
   a second copy of the shape. Required lazily: both kick off an async loader at
   module load, and the gateway must not depend on winning that race. */
function logsCommand() {
  return require("../../commands/utility/logs");
}

function ticketCommand() {
  return require("../../commands/utility/ticket");
}

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function has(object, key) {
  return object && Object.prototype.hasOwnProperty.call(object, key);
}

function readChannelId(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !SNOWFLAKE.test(value)) throw badRequest(`${label} must be a channel id.`);
  return value;
}

function readRoleId(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !SNOWFLAKE.test(value)) throw badRequest(`${label} must be a role id.`);
  return value;
}

function readBoolean(value, label) {
  if (typeof value !== "boolean") throw badRequest(`${label} must be true or false.`);
  return value;
}

function readOptions(client, guildId) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) return { channels: [], roles: [] };

  const channels = [...(guild.channels?.cache?.values?.() || [])]
    .filter((channel) => TEXT_CHANNEL_TYPES.has(channel.type))
    .map((channel) => ({ id: channel.id, name: channel.name }));

  const roles = [...(guild.roles?.cache?.values?.() || [])]
    .filter((role) => !role.managed && role.name !== "@everyone")
    .map((role) => ({ id: role.id, name: role.name }));

  return { channels, roles };
}

/* ---------------------------------------------------------------- reads --- */

function readLogsSettings(guildId) {
  const config = logsCommand().getGuildLogsConfig(guildId) || null;

  // `configured` is the distinction the UI needs. Logging cannot be switched on
  // from here without channels to write into, and creating a category plus four
  // channels is a provisioning step that wants Manage Channels — not a setting.
  return {
    configured: Boolean(config?.channels),
    enabled: Boolean(config?.enabled),
    categoryId: config?.categoryId ?? null,
    categories: Object.fromEntries(LOG_CATEGORY_KEYS.map((key) => [key, Boolean(config?.categories?.[key])])),
    channels: Object.fromEntries(LOG_CATEGORY_KEYS.map((key) => [key, config?.channels?.[key] ?? null])),
    accessRoles: Array.isArray(config?.accessRoles) ? [...config.accessRoles] : [],
  };
}

function readTicketSettings(guildId) {
  const command = ticketCommand();
  const config = command.getGuildConfig(guildId) || null;

  return {
    enabled: Boolean(config?.enabled),
    channelId: config?.channelId ?? null,
    roleId: config?.roleId ?? null,
    openCount: (command.getGuildTickets(guildId, "open") || []).length,
    totalCount: (command.getGuildTickets(guildId) || []).length,
  };
}

function readEqualizerSettings(guildId) {
  const stored = getEqualizerState(guildId) || {};
  const bands = new Array(EQ_BAND_COUNT).fill(0);

  for (const entry of Array.isArray(stored.equalizer) ? stored.equalizer : []) {
    const band = Number(entry?.band);
    if (Number.isInteger(band) && band >= 0 && band < EQ_BAND_COUNT) bands[band] = Number(entry.gain) || 0;
  }

  return {
    preset: stored.preset || "flat",
    bands,
    presets: Object.keys(EQUALIZER_PRESETS),
    // Sent rather than hardcoded in the browser. The Activity once shipped its
    // own copy of this list and drifted from the real Lavalink bands, which is
    // a bug nobody can see — the sliders simply lie about what they change.
    frequencies: [...require("../equalizer/panel").BAND_FREQUENCIES],
    minGain: SAFE_EQ_MIN_GAIN,
    maxGain: SAFE_EQ_MAX_GAIN,
  };
}

function readStats(guildId) {
  const stats = statsStore.getGuildStats(guildId);
  const num = (value) => Number(value) || 0;

  return {
    hasData: Boolean(stats),
    songsPlayed: num(stats?.songsPlayed),
    msPlayed: num(stats?.msPlayed),
    songsSkipped: num(stats?.songsSkipped),
    streamsPlayed: num(stats?.streamsPlayed),
    playlistsAdded: num(stats?.playlistsAdded),
    totalSessions: num(stats?.totalSessions),
    peakListeners: num(stats?.peakListeners),
    uniqueListeners: num(stats?.uniqueUserCount),
    averageSessionMs: num(stats?.averageSessionLength),
    firstPlayedAt: stats?.firstPlayedAt ?? null,
    lastPlayedAt: stats?.lastPlayedAt ?? null,
    topSources: statsStore.getTopSources(guildId, 4) || [],
    mostActiveHour: statsStore.getMostActiveHour(guildId),
  };
}

function readGuildSettings(client, guildId) {
  const state = getGuildState(guildId);
  const dj = djStore.getGuildConfig(guildId);

  return {
    player: {
      playerChannel: state.playerChannel ?? null,
      autoplay: Boolean(state.autoplay),
      radio247: Boolean(state.radio247),
    },
    source: { defaultSource: state.defaultSource || "deezer" },
    announcements: {
      announcementChannel: state.announcementChannel ?? null,
      announcementsEnabled: state.announcementsEnabled !== false,
    },
    dj: {
      enabled: Boolean(dj.enabled),
      roleId: dj.roleId ?? null,
      skipMode: dj.skipMode,
      voteThreshold: dj.voteThreshold,
      strictMode: Boolean(dj.strictMode),
    },
    logs: readLogsSettings(guildId),
    tickets: readTicketSettings(guildId),
    equalizer: readEqualizerSettings(guildId),
    stats: readStats(guildId),
    options: readOptions(client, guildId),
  };
}

/* --------------------------------------------------------------- writes --- */

/**
 * Mirrors `/logs access`: the stored role list and the Discord permission
 * overwrites have to move together. A role is recorded only once its overwrite
 * actually landed, so the list never claims access Discord did not grant.
 */
async function syncLogAccessRoles(client, guildId, config, nextRoles, warnings) {
  const current = new Set(Array.isArray(config.accessRoles) ? config.accessRoles : []);
  const wanted = new Set(nextRoles);
  const granted = nextRoles.filter((roleId) => !current.has(roleId));
  const revoked = [...current].filter((roleId) => !wanted.has(roleId));
  if (!granted.length && !revoked.length) return [...current];

  const guild = client?.guilds?.cache?.get(guildId);
  const category = config.categoryId ? await guild?.channels?.fetch(config.categoryId).catch(() => null) : null;
  if (!category) throw badRequest("The log category is missing. Run /logs setup again before changing access.");

  const targets = [category];
  for (const channelId of Object.values(config.channels || {})) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) targets.push(channel);
  }

  const applied = new Set(current);
  const changes = [...granted.map((id) => [id, true]), ...revoked.map((id) => [id, false])];

  for (const [roleId, allow] of changes) {
    const update = allow
      ? { ViewChannel: true, ReadMessageHistory: true, SendMessages: false, AddReactions: false }
      : { ViewChannel: false };

    try {
      for (const target of targets) {
        await target.permissionOverwrites.edit(roleId, update);
      }
      if (allow) applied.add(roleId);
      else applied.delete(roleId);
    } catch (error) {
      // Report rather than fail the whole patch: the stored list stays truthful
      // because the role is simply not recorded, and the other settings in this
      // request are unrelated and already valid.
      warnings.push(`Could not ${allow ? "grant" : "revoke"} log access for that role: ${error.message}`);
      Log.warning("Dashboard log access change failed", "", `guild=${guildId}`, `role=${roleId}`, `error=${error.message}`);
    }
  }

  return [...applied];
}

async function applyLogsPatch(client, guildId, patch, warnings) {
  const command = logsCommand();
  const config = command.getGuildLogsConfig(guildId);

  if (!config?.channels) throw badRequest("Logging is not set up in this server yet. Run /logs setup first.");

  const next = {
    ...config,
    categories: { ...(config.categories || {}) },
    channels: { ...(config.channels || {}) },
  };

  if (has(patch, "enabled")) next.enabled = readBoolean(patch.enabled, "Logging");

  if (patch.categories) {
    for (const key of LOG_CATEGORY_KEYS) {
      if (has(patch.categories, key)) next.categories[key] = readBoolean(patch.categories[key], `${key} logs`);
    }
  }

  if (patch.channels) {
    for (const key of LOG_CATEGORY_KEYS) {
      if (!has(patch.channels, key)) continue;
      const channelId = readChannelId(patch.channels[key], `${key} log channel`);
      if (!channelId) throw badRequest(`A channel is required for ${key} logs.`);
      next.channels[key] = channelId;
    }
  }

  if (has(patch, "accessRoles")) {
    if (!Array.isArray(patch.accessRoles)) throw badRequest("Access roles must be a list of role ids.");
    const roles = patch.accessRoles.map((value) => readRoleId(value, "Access role")).filter(Boolean);
    next.accessRoles = await syncLogAccessRoles(client, guildId, config, [...new Set(roles)], warnings);
  }

  // `/logs disable` treats "every category off" as logging off. Match it, or the
  // dashboard leaves behind a config the slash commands consider inconsistent.
  if (next.enabled && !LOG_CATEGORY_KEYS.some((key) => next.categories[key])) next.enabled = false;

  await command.updateGuildLogsConfig(guildId, next);
}

function applyTicketsPatch(guildId, patch) {
  const command = ticketCommand();
  const config = command.getGuildConfig(guildId) || {};
  const next = {
    channelId: config.channelId ?? null,
    roleId: config.roleId ?? null,
    enabled: Boolean(config.enabled),
  };

  if (has(patch, "channelId")) next.channelId = readChannelId(patch.channelId, "Ticket channel");
  if (has(patch, "roleId")) next.roleId = readRoleId(patch.roleId, "Ticket ping role");
  if (has(patch, "enabled")) next.enabled = readBoolean(patch.enabled, "Ticket system");

  // A ticket has nowhere to be delivered without a channel, and the command
  // requires one at setup. Refuse rather than storing a system that reads as on
  // while silently dropping every submission.
  if (next.enabled && !next.channelId) throw badRequest("Choose a channel before turning the ticket system on.");

  command.setGuildConfig(guildId, next);
}

async function applyEqualizerPatch(guildId, patch, warnings) {
  let request = null;

  if (has(patch, "bands")) {
    if (!Array.isArray(patch.bands)) throw badRequest("Equalizer bands must be a list of gains.");
    if (patch.bands.length !== EQ_BAND_COUNT) throw badRequest(`Expected ${EQ_BAND_COUNT} equalizer bands.`);
    request = patch.bands.map((gain, band) => {
      const value = Number(gain);
      if (!Number.isFinite(value)) throw badRequest("Every equalizer band must be a number.");
      return { band, gain: value };
    });
  } else if (has(patch, "preset")) {
    if (typeof patch.preset !== "string" || !EQUALIZER_PRESETS[patch.preset]) throw badRequest("Unknown equalizer preset.");
    request = patch.preset;
  } else {
    return;
  }

  const nextFilters = buildEqualizerFilters(getEqualizerState(guildId) || {}, request);
  if (!nextFilters) throw badRequest("Unknown equalizer preset.");

  // Persist first. This is the server's stored equalizer and it has to hold
  // whether or not anyone happens to be listening right now — playback.js
  // restores it the next time a player is created.
  setEqualizerState(guildId, nextFilters);

  // Then, if a player is live, push the identical filters so the change is
  // audible immediately rather than at the start of the next session.
  const result = await lavalinkSetEqualizer(guildId, request).catch((error) => {
    warnings.push(`Saved for the next session, but the live player did not accept it: ${error.message}`);
    return null;
  });
  if (result && result.status !== "ok" && result.status !== "no_player") {
    warnings.push("Saved for the next session, but the live player rejected the change.");
  }
}

async function applyGuildSettings(guildId, patch = {}, client = null) {
  const stateUpdates = {};
  const warnings = [];

  if (patch.player) {
    if (has(patch.player, "playerChannel")) {
      stateUpdates.playerChannel = readChannelId(patch.player.playerChannel, "Player channel");
    }
    if (has(patch.player, "autoplay")) stateUpdates.autoplay = readBoolean(patch.player.autoplay, "Autoplay");
    if (has(patch.player, "radio247")) stateUpdates.radio247 = readBoolean(patch.player.radio247, "24/7 radio");
  }

  if (patch.source && has(patch.source, "defaultSource")) {
    if (!SOURCES.includes(patch.source.defaultSource)) throw badRequest("Unknown search source.");
    stateUpdates.defaultSource = patch.source.defaultSource;
  }

  if (patch.announcements) {
    if (has(patch.announcements, "announcementChannel")) {
      stateUpdates.announcementChannel = readChannelId(patch.announcements.announcementChannel, "Announcement channel");
    }
    if (has(patch.announcements, "announcementsEnabled")) {
      stateUpdates.announcementsEnabled = readBoolean(patch.announcements.announcementsEnabled, "Announcements");
    }
  }

  if (Object.keys(stateUpdates).length > 0) updateGuildState(guildId, stateUpdates);

  if (patch.dj) {
    const djUpdates = {};
    if (has(patch.dj, "enabled")) djUpdates.enabled = readBoolean(patch.dj.enabled, "DJ mode");
    if (has(patch.dj, "strictMode")) djUpdates.strictMode = readBoolean(patch.dj.strictMode, "Strict mode");
    if (has(patch.dj, "roleId")) djUpdates.roleId = readRoleId(patch.dj.roleId, "DJ role");

    if (has(patch.dj, "skipMode")) {
      if (!SKIP_MODES.includes(patch.dj.skipMode)) throw badRequest("Unknown skip mode.");
      djUpdates.skipMode = patch.dj.skipMode;
    }

    if (has(patch.dj, "voteThreshold")) {
      const parsed = Number(patch.dj.voteThreshold);
      if (!Number.isFinite(parsed) || parsed < 0.1 || parsed > 1) {
        throw badRequest("Vote threshold must be between 0.1 and 1.");
      }
      djUpdates.voteThreshold = parsed;
    }

    if (Object.keys(djUpdates).length > 0) djStore.setGuildConfig(guildId, djUpdates);
  }

  if (patch.logs) await applyLogsPatch(client, guildId, patch.logs, warnings);
  if (patch.tickets) applyTicketsPatch(guildId, patch.tickets);
  if (patch.equalizer) await applyEqualizerPatch(guildId, patch.equalizer, warnings);

  return { settings: readGuildSettings(client, guildId), warnings };
}

module.exports = {
  readGuildSettings,
  applyGuildSettings,
  SOURCES,
  SKIP_MODES,
  LOG_CATEGORY_KEYS,
  EQ_BAND_COUNT,
};
