const statusByChannel = new Map();
const boundClients = new WeakSet();
const knownBotTrackTitles = new Set();

function statusKey(value) {
  return normalizeStatus(value).normalize("NFKC").toLowerCase();
}

function rememberBotTrackTitle(track) {
  const title = normalizeStatus(track?.info?.title);
  if (!title) return;

  knownBotTrackTitles.delete(statusKey(title));
  knownBotTrackTitles.add(statusKey(title));
  if (knownBotTrackTitles.size > 100) {
    knownBotTrackTitles.delete(knownBotTrackTitles.values().next().value);
  }
}

function isBotTrackTitle(value, track = null) {
  const key = statusKey(value);
  if (!key) return false;

  const currentTitle = statusKey(track?.info?.title);
  return (currentTitle && key === currentTitle) || knownBotTrackTitles.has(key);
}

function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function truncateStatus(value) {
  return normalizeStatus(value).slice(0, 500);
}

function rememberStatus(channelId, status, { fromBot = false } = {}) {
  if (!channelId) return;

  const entry = statusByChannel.get(channelId) || { baseStatus: "", botStatus: null };
  const normalized = truncateStatus(status);

  if (fromBot) {
    entry.botStatus = normalized || null;
  } else if (normalized !== entry.botStatus) {
    entry.baseStatus = normalized;
    entry.botStatus = null;
  }

  statusByChannel.set(channelId, entry);
}

function handleRawGatewayPacket(packet) {
  if (!packet) return;

  if (packet.t === "VOICE_CHANNEL_STATUS_UPDATE") {
    rememberStatus(packet.d?.id, packet.d?.status);
    return;
  }

  if (packet.t === "CHANNEL_INFO") {
    for (const channel of packet.d?.channels || []) {
      rememberStatus(channel.id, channel.status);
    }
  }
}

function bindVoiceChannelStatusGateway(client) {
  if (!client || boundClients.has(client)) return;

  client.on("raw", handleRawGatewayPacket);
  boundClients.add(client);
}

function requestGuildChannelStatuses(client, guildId) {
  if (!client?.ws?.broadcast || !guildId) return;

  bindVoiceChannelStatusGateway(client);
  client.ws.broadcast({
    op: 43,
    d: {
      guild_id: guildId,
      fields: ["status"],
    },
  });
}

async function setVoiceChannelStatus(client, channelId, status) {
  if (!client?.rest?.put || !channelId) return false;

  const normalized = truncateStatus(status);
  // Mark the expected bot value before the request so the corresponding
  // Gateway update cannot be mistaken for a user-edited base status.
  rememberStatus(channelId, normalized, { fromBot: true });
  await client.rest.put(`/channels/${channelId}/voice-status`, {
    body: { status: normalized || null },
  });
  return true;
}

function getBaseStatus(channelId, channel, track = null) {
  const cached = statusByChannel.get(channelId);
  if (cached) {
    // Older versions could leave a track title in baseStatus after a restart.
    // Do not carry that title into the next track or restore it at queue end.
    if (isBotTrackTitle(cached.baseStatus, track)) {
      cached.baseStatus = "";
      statusByChannel.set(channelId, cached);
    }
    return cached.baseStatus;
  }

  const channelStatus = normalizeStatus(channel?.status);
  if (isBotTrackTitle(channelStatus, track)) {
    rememberStatus(channelId, "");
    return "";
  }

  rememberStatus(channelId, channelStatus);
  return channelStatus;
}

function hasStatusCache(channelId) {
  return statusByChannel.has(channelId);
}

function buildTrackStatus(baseStatus, track) {
  const title = normalizeStatus(track?.info?.title) || "Unknown track";
  return truncateStatus(baseStatus ? `${baseStatus} | ${title}` : title);
}

async function updateTrackVoiceChannelStatus(client, player, track) {
  const channelId = player?.voiceChannel;
  if (!channelId) return false;

  rememberBotTrackTitle(track);

  const channel = client?.channels?.cache?.get(channelId);
  if (!hasStatusCache(channelId)) {
    requestGuildChannelStatuses(client, player.guildId);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const baseStatus = getBaseStatus(channelId, channel, track);
  return setVoiceChannelStatus(client, channelId, buildTrackStatus(baseStatus, track));
}

async function restoreVoiceChannelStatus(client, channelId) {
  if (!channelId) return false;

  const entry = statusByChannel.get(channelId);
  if (!entry) return false;

  const baseStatus = isBotTrackTitle(entry.baseStatus) ? "" : entry.baseStatus;
  const restored = await setVoiceChannelStatus(client, channelId, baseStatus);
  entry.baseStatus = baseStatus;
  entry.botStatus = null;
  statusByChannel.set(channelId, entry);
  return restored;
}

function clearVoiceChannelStatusCache(channelId) {
  if (channelId) statusByChannel.delete(channelId);
}

module.exports = {
  buildTrackStatus,
  clearVoiceChannelStatusCache,
  getBaseStatus,
  hasStatusCache,
  handleRawGatewayPacket,
  requestGuildChannelStatuses,
  restoreVoiceChannelStatus,
  setVoiceChannelStatus,
  updateTrackVoiceChannelStatus,
};
