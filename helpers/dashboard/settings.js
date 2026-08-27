const djStore = require("../dj/store");
const { getGuildState, updateGuildState } = require("../guildState");

const SOURCES = Object.freeze(["deezer", "youtube", "spotify", "soundcloud"]);
const SKIP_MODES = Object.freeze(["dj", "vote", "hybrid"]);
const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const SNOWFLAKE = /^\d{5,25}$/;

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
    options: readOptions(client, guildId),
  };
}

function applyGuildSettings(guildId, patch = {}, client = null) {
  const stateUpdates = {};

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

    if (has(patch.dj, "roleId")) {
      const value = patch.dj.roleId;
      if (value !== null && value !== "" && (typeof value !== "string" || !SNOWFLAKE.test(value))) {
        throw badRequest("DJ role must be a role id.");
      }
      djUpdates.roleId = value === "" ? null : value;
    }

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

  return readGuildSettings(client, guildId);
}

module.exports = { readGuildSettings, applyGuildSettings, SOURCES, SKIP_MODES };
