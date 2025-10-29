const crypto = require("crypto");
const { loadPlaylists, savePlaylists, getPlaylist, createPlaylist } = require("./store");

// Temporary share codes (stored in memory, expire after 24 hours)
const shareCodes = new Map();

// Clean up expired codes every hour
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of shareCodes.entries()) {
    if (now - data.createdAt > 24 * 60 * 60 * 1000) {
      shareCodes.delete(code);
    }
  }
}, 60 * 60 * 1000);

/**
 * Generate a shareable code for a playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} playlistName - Playlist name
 * @returns {Object} Result with code or error
 */
function generateShareCode(userId, guildId, playlistName) {
  const playlist = getPlaylist(userId, guildId, playlistName);

  if (!playlist) {
    return { success: false, error: `Playlist "${playlistName}" not found.` };
  }

  // Check permissions
  if (playlist.type === "user" && playlist.createdBy !== userId) {
    return { success: false, error: "You can only share playlists you created." };
  }

  if (playlist.type === "server" && playlist.createdBy !== userId) {
    return { success: false, error: "You can only share server playlists you created." };
  }

  // Generate unique code
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();

  // Store code with playlist data
  shareCodes.set(code, {
    playlistId: playlist.id,
    playlistName: playlist.name,
    type: playlist.type,
    createdBy: userId,
    sourceGuildId: guildId,
    tracks: [...playlist.tracks],
    description: playlist.description,
    createdAt: Date.now(),
  });

  return {
    success: true,
    code,
    expiresIn: "24 hours",
    message: `Share code generated: \`${code}\` (expires in 24 hours)`,
  };
}

/**
 * Import a playlist from a share code
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} code - Share code
 * @param {Object} options - Import options
 * @returns {Object} Result
 */
function importFromCode(userId, guildId, code, options = {}) {
  const shareData = shareCodes.get(code.toUpperCase());

  if (!shareData) {
    return { success: false, error: "Invalid or expired share code." };
  }

  // Generate unique name if playlist already exists
  const data = loadPlaylists();
  let playlistName = shareData.playlistName;
  let suffix = 1;

  while (true) {
    const exists = data.user[userId]?.find((p) => p.name.toLowerCase() === playlistName.toLowerCase());
    if (!exists) break;
    playlistName = `${shareData.playlistName} (${suffix})`;
    suffix++;
  }

  // Create new playlist with imported tracks
  const result = createPlaylist(userId, guildId, playlistName, {
    type: "user", // Always import as user playlist
    description: shareData.description || `Imported from share code`,
    public: options.public || false,
    collaborative: options.collaborative || false,
  });

  if (!result.success) {
    return result;
  }

  // Reload data to get the newly created playlist and add tracks
  const freshData = loadPlaylists();
  const importedPlaylist = freshData.user[userId].find((p) => p.name === playlistName);

  if (importedPlaylist) {
    importedPlaylist.tracks = shareData.tracks.map((track) => ({
      ...track,
      addedBy: userId,
      addedAt: Date.now(),
    }));
    savePlaylists(freshData);
  }

  return {
    success: true,
    message: `Imported playlist "${playlistName}" with ${shareData.tracks.length} tracks.`,
    playlistName,
    trackCount: shareData.tracks.length,
  };
}

/**
 * Share playlist with specific user
 * @param {string} userId - User ID (sharer)
 * @param {string} guildId - Guild ID
 * @param {string} playlistName - Playlist name
 * @param {string} targetUserId - Target user ID
 * @returns {Object} Result
 */
function shareWithUser(userId, guildId, playlistName, targetUserId) {
  const data = loadPlaylists();

  // Find playlist in data structure
  let targetPlaylist = null;
  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === playlistName.toLowerCase());
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${playlistName}" not found.` };
  }

  if (targetPlaylist.type !== "user" || targetPlaylist.createdBy !== userId) {
    return { success: false, error: "You can only share your own user playlists directly with users." };
  }

  if (targetPlaylist.sharedWith.includes(targetUserId)) {
    return { success: false, error: "Playlist is already shared with this user." };
  }

  targetPlaylist.sharedWith.push(targetUserId);
  savePlaylists(data);

  return { success: true, message: `Shared playlist "${playlistName}" with user.` };
}

/**
 * Unshare playlist with specific user
 * @param {string} userId - User ID (owner)
 * @param {string} guildId - Guild ID
 * @param {string} playlistName - Playlist name
 * @param {string} targetUserId - Target user ID
 * @returns {Object} Result
 */
function unshareWithUser(userId, guildId, playlistName, targetUserId) {
  const data = loadPlaylists();
  const playlist = getPlaylist(userId, guildId, playlistName);

  if (!playlist) {
    return { success: false, error: `Playlist "${playlistName}" not found.` };
  }

  if (playlist.createdBy !== userId) {
    return { success: false, error: "You can only unshare playlists you created." };
  }

  const index = playlist.sharedWith.indexOf(targetUserId);
  if (index === -1) {
    return { success: false, error: "Playlist is not shared with this user." };
  }

  playlist.sharedWith.splice(index, 1);
  savePlaylists(data);

  return { success: true, message: "Unshared playlist with user." };
}

module.exports = {
  generateShareCode,
  importFromCode,
  shareWithUser,
  unshareWithUser,
};
