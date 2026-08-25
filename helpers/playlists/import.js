const { getHighResolutionArtworkUrl } = require("../artwork");
const { createPoru } = require("../lavalink");
const { assertAllowedMusicUrl } = require("../security/mediaUrl");
const { createPlaylist } = require("./store");

const MAX_IMPORTED_TRACKS = 1_000;

/**
 * Extract playlist ID from Spotify URL
 * @param {string} url - Spotify URL
 * @returns {string|null} Playlist ID
 */
function extractSpotifyPlaylistId(url) {
  const match = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Extract playlist ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Playlist ID
 */
function extractYouTubePlaylistId(url) {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function detectPlaylistSource(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  if ((hostname === "spotify.com" || hostname.endsWith(".spotify.com")) && pathname.includes("/playlist/")) return "spotify";
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") return "youtube";
  if ((hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com")) && (pathname.includes("/sets/") || pathname.includes("/set/"))) return "soundcloud";
  if ((hostname === "deezer.com" || hostname.endsWith(".deezer.com")) && pathname.includes("/playlist/")) return "deezer";
  return null;
}

/**
 * Import playlist from Spotify or YouTube URL
 * @param {Object} client - Discord client
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} url - Playlist URL (Spotify or YouTube)
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import result
 */
async function importPlaylistFromUrl(client, userId, guildId, url, options = {}) {
  assertAllowedMusicUrl(url);
  const poru = createPoru(client);

  let playlistId = null;
  const source = detectPlaylistSource(url);

  if (source === "spotify") {
    playlistId = extractSpotifyPlaylistId(url);
  } else if (source === "youtube") {
    playlistId = extractYouTubePlaylistId(url);
  } else if (!source) {
    return { success: false, error: "Invalid URL. Use a Spotify, YouTube, SoundCloud set, or Deezer playlist URL." };
  }

  if (!playlistId && ["spotify", "youtube"].includes(source)) {
    return { success: false, error: "Could not extract playlist ID from URL." };
  }

  try {
    // Resolve playlist with Lavalink
    const resolved = await poru.resolve({ query: url, source });

    if (!resolved?.tracks || resolved.tracks.length === 0) {
      return { success: false, error: "No tracks found in the playlist or playlist is private/unavailable." };
    }

    // Get playlist name from metadata
    const playlistName =
      resolved.playlistInfo?.name ||
      options.name ||
      `Imported ${source === "spotify" ? "Spotify" : "YouTube"} Playlist`;

    // Extract thumbnail from first track or playlist info
    let thumbnail = null;
    if (resolved.playlistInfo?.artworkUrl) {
      thumbnail = getHighResolutionArtworkUrl(resolved.playlistInfo.artworkUrl);
    } else if (resolved.tracks[0]?.info?.artworkUrl) {
      thumbnail = getHighResolutionArtworkUrl(resolved.tracks[0].info.artworkUrl);
    } else if (resolved.tracks[0]?.info?.image) {
      thumbnail = getHighResolutionArtworkUrl(resolved.tracks[0].info.image);
    }

    // Create playlist
    const result = createPlaylist(userId, guildId, playlistName, {
      type: options.type || "user",
      description: options.description || `Imported from ${({ spotify: "Spotify", youtube: "YouTube", soundcloud: "SoundCloud", deezer: "Deezer" })[source] || source}`,
      public: options.public || false,
      collaborative: options.collaborative || false,
      thumbnail,
    });

    if (!result.success) {
      return result;
    }

    // Add all tracks to the playlist
    const { loadPlaylists, savePlaylists } = require("./store");
    const data = loadPlaylists();
    const storageType = result.playlist.type;
    const storageKey = storageType === "server" ? guildId : userId;

    const targetPlaylist = data[storageType][storageKey].find((p) => p.id === result.playlist.id);

    if (targetPlaylist) {
      targetPlaylist.tracks = resolved.tracks.slice(0, MAX_IMPORTED_TRACKS).map((track) => ({
        title: track.info.title,
        author: track.info.author,
        identifier: track.info.identifier,
        uri: track.info.uri,
        length: track.info.length,
        artworkUrl: track.info.artworkUrl || track.info.thumbnail || track.info.image || null,
        source: track.info.sourceName || track.info.source || source,
        addedBy: userId,
        addedAt: Date.now(),
      }));

      savePlaylists(data);
    }

    return {
      success: true,
      message: `Imported playlist "${playlistName}" with ${Math.min(resolved.tracks.length, MAX_IMPORTED_TRACKS)} tracks.`,
      playlistName,
      trackCount: Math.min(resolved.tracks.length, MAX_IMPORTED_TRACKS),
      source,
      thumbnail,
    };
  } catch (error) {
    console.error("Playlist import error:", error);
    return {
      success: false,
      error: "The playlist could not be imported. Check that it is public and try again.",
    };
  }
}

/**
 * Auto-update playlist thumbnail based on tracks
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} playlistName - Playlist name
 * @returns {Object} Update result
 */
function autoUpdateThumbnail(userId, guildId, playlistName) {
  const { loadPlaylists, savePlaylists } = require("./store");
  const data = loadPlaylists();

  // Find playlist in data structure
  let targetPlaylist = null;

  if (data.user[userId]) {
    targetPlaylist = data.user[userId].find((p) => p.name.toLowerCase() === playlistName.toLowerCase());
  }

  if (!targetPlaylist && data.server[guildId]) {
    targetPlaylist = data.server[guildId].find((p) => p.name.toLowerCase() === playlistName.toLowerCase());
  }

  if (!targetPlaylist) {
    return { success: false, error: `Playlist "${playlistName}" not found.` };
  }

  // Placeholder for future enhancement - would need to resolve tracks again to get artwork
  targetPlaylist.thumbnail = targetPlaylist.thumbnail || null;

  savePlaylists(data);
  return { success: true, message: "Thumbnail updated." };
}

module.exports = {
  importPlaylistFromUrl,
  extractSpotifyPlaylistId,
  extractYouTubePlaylistId,
  detectPlaylistSource,
  autoUpdateThumbnail,
};
