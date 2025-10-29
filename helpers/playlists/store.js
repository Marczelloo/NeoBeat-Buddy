const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PLAYLISTS_FILE = path.join(__dirname, "../data/playlists.json");

/**
 * Load playlists from file
 * @returns {Object} Playlists data
 */
function loadPlaylists() {
  try {
    if (!fs.existsSync(PLAYLISTS_FILE)) {
      const initialData = { user: {}, server: {} };
      fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(PLAYLISTS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load playlists:", err);
    return { user: {}, server: {} };
  }
}

/**
 * Save playlists to file
 * @param {Object} data - Playlists data to save
 */
function savePlaylists(data) {
  try {
    fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save playlists:", err);
    throw err;
  }
}

/**
 * Generate unique playlist ID
 * @returns {string} Unique ID
 */
function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Create a new playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID (null for user playlists)
 * @param {string} name - Playlist name
 * @param {Object} options - Additional options
 * @returns {Object} Created playlist or error
 */
function createPlaylist(userId, guildId, name, options = {}) {
  const data = loadPlaylists();
  const isServer = options.type === "server";
  const key = isServer ? guildId : userId;
  const type = isServer ? "server" : "user";

  // Initialize storage if needed
  if (!data[type][key]) {
    data[type][key] = [];
  }

  // Check for duplicate name
  const existing = data[type][key].find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return { success: false, error: `A ${type} playlist named "${name}" already exists.` };
  }

  const playlist = {
    id: generateId(),
    name,
    type,
    description: options.description || "",
    public: options.public || false,
    collaborative: options.collaborative || false,
    tracks: [],
    thumbnail: options.thumbnail || null,
    createdBy: userId,
    createdAt: Date.now(),
    guildId: isServer ? guildId : null,
    collaborators: options.collaborative ? [userId] : [],
    sharedWith: [],
    sharedGuilds: [],
  };

  data[type][key].push(playlist);
  savePlaylists(data);

  return { success: true, playlist };
}

/**
 * Delete a playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @returns {Object} Result
 */
function deletePlaylist(userId, guildId, name) {
  const data = loadPlaylists();

  // Try user playlists first
  if (data.user[userId]) {
    const index = data.user[userId].findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    if (index !== -1) {
      const playlist = data.user[userId][index];
      if (playlist.isDefault) {
        return { success: false, error: "Cannot delete the default 'Liked Songs' playlist." };
      }
      if (playlist.createdBy !== userId) {
        return { success: false, error: "You can only delete playlists you created." };
      }
      data.user[userId].splice(index, 1);
      savePlaylists(data);
      return { success: true, message: `Deleted user playlist "${name}".` };
    }
  }

  // Try server playlists
  if (data.server[guildId]) {
    const index = data.server[guildId].findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    if (index !== -1) {
      const playlist = data.server[guildId][index];
      if (playlist.createdBy !== userId) {
        return { success: false, error: "You can only delete playlists you created." };
      }
      data.server[guildId].splice(index, 1);
      savePlaylists(data);
      return { success: true, message: `Deleted server playlist "${name}".` };
    }
  }

  return { success: false, error: `Playlist "${name}" not found.` };
}

/**
 * Get a playlist by name
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @returns {Object|null} Playlist or null
 */
function getPlaylist(userId, guildId, name) {
  const data = loadPlaylists();

  // Search user playlists
  if (data.user[userId]) {
    const playlist = data.user[userId].find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (playlist) return playlist;
  }

  // Search server playlists
  if (data.server[guildId]) {
    const playlist = data.server[guildId].find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (playlist) return playlist;
  }

  // Search shared playlists
  for (const userPlaylists of Object.values(data.user)) {
    const playlist = userPlaylists.find(
      (p) =>
        p.name.toLowerCase() === name.toLowerCase() &&
        (p.public || p.sharedWith.includes(userId) || p.sharedGuilds.includes(guildId))
    );
    if (playlist) return playlist;
  }

  return null;
}

/**
 * Add track to playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {Object} track - Track object
 * @returns {Object} Result
 */
function addTrack(userId, guildId, name, track) {
  const data = loadPlaylists();

  // Find playlist in data structure
  let targetPlaylist = null;

  // Search user playlists
  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  // Search server playlists
  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  // Search shared playlists
  if (!targetPlaylist) {
    for (const userPlaylists of Object.values(data.user)) {
      const playlist = userPlaylists.find(
        (p) =>
          p.name.toLowerCase() === name.toLowerCase() &&
          (p.public || p.sharedWith.includes(userId) || p.sharedGuilds.includes(guildId))
      );
      if (playlist) {
        targetPlaylist = playlist;
        break;
      }
    }
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${name}" not found.` };
  }

  // Check permissions
  if (
    targetPlaylist.type === "user" &&
    targetPlaylist.createdBy !== userId &&
    !targetPlaylist.collaborators.includes(userId)
  ) {
    if (!targetPlaylist.collaborative || !targetPlaylist.sharedWith.includes(userId)) {
      return { success: false, error: "You don't have permission to add tracks to this playlist." };
    }
  }

  if (targetPlaylist.type === "server" && !targetPlaylist.collaborative && targetPlaylist.createdBy !== userId) {
    return { success: false, error: "Only the creator can add tracks to this playlist (not collaborative)." };
  }

  // Add track to the playlist in the data structure
  targetPlaylist.tracks.push({
    title: track.info?.title || track.title,
    author: track.info?.author || track.author,
    identifier: track.info?.identifier || track.identifier,
    uri: track.info?.uri || track.uri,
    length: track.info?.length || track.length,
    addedBy: userId,
    addedAt: Date.now(),
  });

  savePlaylists(data);
  return { success: true, message: `Added "${track.info?.title || track.title}" to playlist "${name}".` };
}

/**
 * Remove track from playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {number} position - Track position (1-indexed)
 * @returns {Object} Result
 */
function removeTrack(userId, guildId, name, position) {
  const data = loadPlaylists();

  // Find playlist in data structure (same logic as addTrack)
  let targetPlaylist = null;

  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  if (!targetPlaylist) {
    for (const userPlaylists of Object.values(data.user)) {
      const playlist = userPlaylists.find(
        (p) =>
          p.name.toLowerCase() === name.toLowerCase() &&
          (p.public || p.sharedWith.includes(userId) || p.sharedGuilds.includes(guildId))
      );
      if (playlist) {
        targetPlaylist = playlist;
        break;
      }
    }
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${name}" not found.` };
  }

  // Check permissions
  if (
    targetPlaylist.type === "user" &&
    targetPlaylist.createdBy !== userId &&
    !targetPlaylist.collaborators.includes(userId)
  ) {
    if (!targetPlaylist.collaborative || !targetPlaylist.sharedWith.includes(userId)) {
      return { success: false, error: "You don't have permission to remove tracks from this playlist." };
    }
  }

  if (targetPlaylist.type === "server" && !targetPlaylist.collaborative && targetPlaylist.createdBy !== userId) {
    return { success: false, error: "Only the creator can remove tracks from this playlist (not collaborative)." };
  }

  const index = position - 1;
  if (index < 0 || index >= targetPlaylist.tracks.length) {
    return { success: false, error: `Invalid position. Playlist has ${targetPlaylist.tracks.length} tracks.` };
  }

  const removed = targetPlaylist.tracks.splice(index, 1)[0];
  savePlaylists(data);

  return { success: true, message: `Removed "${removed.title}" from playlist "${name}".` };
}

/**
 * Rename playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} oldName - Current playlist name
 * @param {string} newName - New playlist name
 * @returns {Object} Result
 */
function renamePlaylist(userId, guildId, oldName, newName) {
  const data = loadPlaylists();

  // Find playlist in data structure
  let targetPlaylist = null;
  let storageType = null;
  let storageKey = null;

  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === oldName.toLowerCase());
    if (targetPlaylist) {
      storageType = "user";
      storageKey = userId;
    }
  }

  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === oldName.toLowerCase());
    if (targetPlaylist) {
      storageType = "server";
      storageKey = guildId;
    }
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${oldName}" not found.` };
  }

  if (targetPlaylist.isDefault) {
    return { success: false, error: "Cannot rename the default 'Liked Songs' playlist." };
  }

  if (targetPlaylist.createdBy !== userId) {
    return { success: false, error: "Only the creator can rename this playlist." };
  }

  // Check for duplicate new name
  const duplicate = data[storageType][storageKey]?.find(
    (p) => p.id !== targetPlaylist.id && p.name.toLowerCase() === newName.toLowerCase()
  );

  if (duplicate) {
    return { success: false, error: `A ${storageType} playlist named "${newName}" already exists.` };
  }

  targetPlaylist.name = newName;
  savePlaylists(data);

  return { success: true, message: `Renamed playlist to "${newName}".` };
}

/**
 * Move track within playlist
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {number} from - Source position (1-indexed)
 * @param {number} to - Target position (1-indexed)
 * @returns {Object} Result
 */
function moveTrack(userId, guildId, name, from, to) {
  const data = loadPlaylists();

  // Find playlist in data structure
  let targetPlaylist = null;

  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${name}" not found.` };
  }

  if (targetPlaylist.createdBy !== userId && !targetPlaylist.collaborators.includes(userId)) {
    return { success: false, error: "You don't have permission to reorder tracks in this playlist." };
  }

  const fromIndex = from - 1;
  const toIndex = to - 1;

  if (
    fromIndex < 0 ||
    fromIndex >= targetPlaylist.tracks.length ||
    toIndex < 0 ||
    toIndex >= targetPlaylist.tracks.length
  ) {
    return { success: false, error: `Invalid positions. Playlist has ${targetPlaylist.tracks.length} tracks.` };
  }

  const [track] = targetPlaylist.tracks.splice(fromIndex, 1);
  targetPlaylist.tracks.splice(toIndex, 0, track);
  savePlaylists(data);

  return { success: true, message: `Moved "${track.title}" from position ${from} to ${to}.` };
}

/**
 * Edit playlist metadata
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {Object} updates - Updates to apply
 * @returns {Object} Result
 */
function editPlaylist(userId, guildId, name, updates) {
  const data = loadPlaylists();

  // Find playlist in data structure
  let targetPlaylist = null;

  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${name}" not found.` };
  }

  if (targetPlaylist.createdBy !== userId) {
    return { success: false, error: "Only the creator can edit this playlist." };
  }

  if (targetPlaylist.isDefault) {
    if (updates.description !== undefined || updates.public !== undefined) {
      return {
        success: false,
        error: "Cannot change description or visibility of the default 'Liked Songs' playlist.",
      };
    }
  }

  if (updates.description !== undefined) targetPlaylist.description = updates.description;
  if (updates.public !== undefined) targetPlaylist.public = updates.public;
  if (updates.thumbnail !== undefined) targetPlaylist.thumbnail = updates.thumbnail;
  if (updates.collaborative !== undefined) {
    targetPlaylist.collaborative = updates.collaborative;
    if (updates.collaborative && !targetPlaylist.collaborators.includes(userId)) {
      targetPlaylist.collaborators.push(userId);
    }
  }

  savePlaylists(data);
  return { success: true, message: `Updated playlist "${name}".` };
}

/**
 * Add/remove collaborator
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} name - Playlist name
 * @param {string} collaboratorId - Collaborator user ID
 * @param {string} action - "add" or "remove"
 * @returns {Object} Result
 */
function manageCollaborator(userId, guildId, name, collaboratorId, action) {
  const data = loadPlaylists();
  const playlist = getPlaylist(userId, guildId, name);

  if (!playlist) {
    return { success: false, error: `Playlist "${name}" not found.` };
  }

  if (playlist.createdBy !== userId) {
    return { success: false, error: "Only the creator can manage collaborators." };
  }

  if (!playlist.collaborative) {
    return { success: false, error: "This playlist is not collaborative. Enable collaborative mode first." };
  }

  if (action === "add") {
    if (playlist.collaborators.includes(collaboratorId)) {
      return { success: false, error: "User is already a collaborator." };
    }
    playlist.collaborators.push(collaboratorId);
    savePlaylists(data);
    return { success: true, message: "Added collaborator." };
  } else if (action === "remove") {
    const index = playlist.collaborators.indexOf(collaboratorId);
    if (index === -1) {
      return { success: false, error: "User is not a collaborator." };
    }
    if (collaboratorId === playlist.createdBy) {
      return { success: false, error: "Cannot remove the playlist creator." };
    }
    playlist.collaborators.splice(index, 1);
    savePlaylists(data);
    return { success: true, message: "Removed collaborator." };
  }

  return { success: false, error: "Invalid action." };
}

/**
 * List playlists accessible to user
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} filter - Filter type: all, user, server, shared
 * @param {string} targetUserId - Optional user ID to view their playlists
 * @returns {Array} Array of playlists
 */
function listPlaylists(userId, guildId, filter = "all", targetUserId = null) {
  const data = loadPlaylists();
  const playlists = [];

  // User playlists (own or target user's public ones)
  if (filter === "all" || filter === "user") {
    const userKey = targetUserId || userId;
    if (data.user[userKey]) {
      data.user[userKey].forEach((p) => {
        if (targetUserId && targetUserId !== userId) {
          // Viewing someone else's playlists - only show public or shared
          if (p.public || p.sharedWith.includes(userId)) {
            playlists.push(p);
          }
        } else {
          playlists.push(p);
        }
      });
    }
  }

  // Server playlists
  if ((filter === "all" || filter === "server") && !targetUserId) {
    if (data.server[guildId]) {
      playlists.push(...data.server[guildId]);
    }
  }

  // Shared playlists from other users
  if ((filter === "all" || filter === "shared") && !targetUserId) {
    for (const [userKey, userPlaylists] of Object.entries(data.user)) {
      if (userKey !== userId) {
        userPlaylists.forEach((p) => {
          if (p.sharedWith.includes(userId) || p.sharedGuilds.includes(guildId) || p.public) {
            playlists.push({ ...p, isShared: true });
          }
        });
      }
    }
  }

  return playlists;
}

/**
 * Merge two playlists
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} targetName - Target playlist name
 * @param {string} sourceName - Source playlist name
 * @returns {Object} Result
 */
function mergePlaylists(userId, guildId, targetName, sourceName) {
  const data = loadPlaylists();

  // Find target playlist in data structure
  let targetPlaylist = null;
  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === targetName.toLowerCase());
  }
  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === targetName.toLowerCase());
  }

  // Find source playlist (can use getPlaylist since we're just reading)
  const source = getPlaylist(userId, guildId, sourceName);

  if (!targetPlaylist) {
    return { success: false, error: `Target playlist "${targetName}" not found.` };
  }

  if (!source) {
    return { success: false, error: `Source playlist "${sourceName}" not found.` };
  }

  if (targetPlaylist.createdBy !== userId && !targetPlaylist.collaborators.includes(userId)) {
    return { success: false, error: "You don't have permission to modify the target playlist." };
  }

  // Add all tracks from source to target
  source.tracks.forEach((track) => {
    targetPlaylist.tracks.push({
      ...track,
      addedBy: userId,
      addedAt: Date.now(),
    });
  });

  savePlaylists(data);
  return { success: true, message: `Merged ${source.tracks.length} tracks from "${sourceName}" into "${targetName}".` };
}

/**
 * Get "Liked Songs" playlist for user (auto-create if doesn't exist)
 * @param {string} userId - User ID
 * @returns {Object} Liked Songs playlist
 */
function getLikedSongs(userId) {
  const data = loadPlaylists();

  if (!data.user[userId]) {
    data.user[userId] = [];
  }

  let likedSongs = data.user[userId].find((p) => p.name === "Liked Songs");

  if (!likedSongs) {
    likedSongs = {
      id: generateId(),
      name: "Liked Songs",
      type: "user",
      description: "Your liked tracks",
      public: false,
      collaborative: false,
      tracks: [],
      thumbnail: null,
      createdBy: userId,
      createdAt: Date.now(),
      guildId: null,
      collaborators: [],
      sharedWith: [],
      sharedGuilds: [],
      isDefault: true, // Special flag for liked songs
    };
    data.user[userId].push(likedSongs);
    savePlaylists(data);
  }

  return likedSongs;
}

module.exports = {
  loadPlaylists,
  savePlaylists,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  addTrack,
  removeTrack,
  renamePlaylist,
  moveTrack,
  editPlaylist,
  manageCollaborator,
  listPlaylists,
  mergePlaylists,
  getLikedSongs,
};
