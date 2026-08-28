const { loadPlaylists, savePlaylists } = require("../playlists/store");

/**
 * Server playlists, as the people who run the server see them.
 *
 * `/playlist` enforces creator-only editing everywhere, which is right between
 * members: your playlist is yours. It is wrong for the person who runs the
 * server, who otherwise cannot clear out a playlist left behind by someone who
 * has gone.
 *
 * Rather than thread a moderator flag through the ten creator checks in
 * helpers/playlists/store.js — and risk loosening the rules for members as a
 * side effect — this module touches only `data.server[guildId]`, and only for a
 * guild the caller already administers. User playlists are never reachable from
 * here, so nothing about the member-facing rules changes.
 *
 * Tracks are read-only: adding one means resolving it against a provider, which
 * is the player's job and belongs in Discord or the Activity.
 */

const MAX_NAME = 80;
const MAX_DESCRIPTION = 300;

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function serializeTrack(track) {
  return {
    title: track?.title || track?.info?.title || "Unknown track",
    author: track?.author || track?.info?.author || "Unknown artist",
    durationMs: Number(track?.duration ?? track?.length ?? track?.info?.length) || 0,
    source: track?.source || track?.info?.sourceName || null,
  };
}

function serializePlaylist(playlist, { withTracks = false } = {}) {
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description || "",
    createdBy: playlist.createdBy || null,
    createdAt: playlist.createdAt || null,
    collaborative: Boolean(playlist.collaborative),
    trackCount: tracks.length,
    durationMs: tracks.reduce((sum, track) => sum + (Number(track?.duration ?? track?.length) || 0), 0),
    ...(withTracks ? { tracks: tracks.map(serializeTrack) } : {}),
  };
}

async function listServerPlaylists(client, guildId) {
  const data = loadPlaylists();
  const playlists = data.server?.[guildId] || [];
  const guild = client?.guilds?.cache?.get(guildId);

  const result = [];
  for (const playlist of playlists) {
    const serialized = serializePlaylist(playlist, { withTracks: true });
    // Resolve the creator so the owner sees a name rather than a snowflake —
    // and can tell which playlists belong to people who have since left.
    const member = playlist.createdBy ? await guild?.members?.fetch(playlist.createdBy).catch(() => null) : null;
    serialized.createdByName = member?.user?.globalName || member?.user?.username || null;
    result.push(serialized);
  }
  return result;
}

function findServerPlaylist(data, guildId, playlistId) {
  const playlists = data.server?.[guildId] || [];
  const index = playlists.findIndex((playlist) => playlist.id === playlistId);
  if (index === -1) throw notFound("That playlist no longer exists.");
  return { playlists, index };
}

function editServerPlaylist(guildId, playlistId, patch = {}) {
  const data = loadPlaylists();
  const { playlists, index } = findServerPlaylist(data, guildId, playlistId);
  const playlist = playlists[index];

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    const name = String(patch.name || "").trim().replace(/\s+/g, " ");
    if (!name) throw badRequest("A playlist needs a name.");
    if (name.length > MAX_NAME) throw badRequest(`Names are at most ${MAX_NAME} characters.`);
    const clash = playlists.some(
      (other) => other.id !== playlistId && other.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) throw badRequest(`This server already has a playlist called "${name}".`);
    playlist.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "description")) {
    const description = String(patch.description ?? "").trim();
    if (description.length > MAX_DESCRIPTION) {
      throw badRequest(`Descriptions are at most ${MAX_DESCRIPTION} characters.`);
    }
    playlist.description = description;
  }

  savePlaylists(data);
  return serializePlaylist(playlist, { withTracks: true });
}

function deleteServerPlaylist(guildId, playlistId) {
  const data = loadPlaylists();
  const { playlists, index } = findServerPlaylist(data, guildId, playlistId);
  const [removed] = playlists.splice(index, 1);
  savePlaylists(data);
  return { name: removed.name, trackCount: (removed.tracks || []).length };
}

module.exports = {
  listServerPlaylists,
  editServerPlaylist,
  deleteServerPlaylist,
  MAX_NAME,
  MAX_DESCRIPTION,
};
