const Log = require("../logs/log");

let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

/**
 * Gets or refreshes Spotify access token
 * @returns {Promise<string|null>} Access token or null if credentials unavailable
 */
async function getSpotifyToken() {
  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    Log.warning("Spotify credentials not configured, skipping recommendations");
    return null;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      Log.error("Failed to get Spotify token", "", `status=${response.status}`);
      return null;
    }

    const data = await response.json();
    spotifyAccessToken = data.access_token;
    spotifyTokenExpiry = Date.now() + data.expires_in * 1000 - 60000;

    Log.info("Spotify access token obtained");
    return spotifyAccessToken;
  } catch (err) {
    Log.error("Error getting Spotify token", err);
    return null;
  }
}

/**
 * Searches for a track on Spotify
 * @param {string} trackTitle - Track title
 * @param {string} artistName - Artist name
 * @returns {Promise<string|null>} Spotify track ID or null
 */
async function searchSpotifyTrack(trackTitle, artistName) {
  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    const query = encodeURIComponent(`track:${trackTitle} artist:${artistName}`);
    const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      Log.warning("Spotify search failed", "", `status=${response.status}`);
      return null;
    }

    const data = await response.json();
    const track = data.tracks?.items?.[0];

    if (track) {
      Log.info("Found track on Spotify", "", `track=${track.name}`, `artist=${track.artists[0]?.name}`);
      return track.id;
    }

    return null;
  } catch (err) {
    Log.error("Error searching Spotify", err);
    return null;
  }
}

/**
 * Gets detailed track information from Spotify
 * @param {string} trackId - Spotify track ID
 * @returns {Promise<Object|null>} Track details with features, genres, popularity
 */
async function getTrackDetails(trackId) {
  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    const [trackResponse, featuresResponse] = await Promise.all([
      fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const track = trackResponse.ok ? await trackResponse.json() : null;
    const features = featuresResponse.ok ? await featuresResponse.json() : null;

    if (!track) return null;

    const releaseDate = track.album?.release_date;
    const releaseYear = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;

    return {
      id: track.id,
      title: track.name,
      artist: track.artists[0]?.name || "Unknown",
      artistIds: track.artists.map((a) => a.id),
      popularity: track.popularity || 0,
      releaseYear,
      genres: [],
      features: features
        ? {
            energy: features.energy,
            danceability: features.danceability,
            valence: features.valence,
            tempo: features.tempo,
            acousticness: features.acousticness,
            instrumentalness: features.instrumentalness,
          }
        : null,
    };
  } catch (err) {
    Log.error("Error getting track details", err);
    return null;
  }
}

/**
 * Gets genres for a list of artist IDs
 * @param {Array<string>} artistIds - Spotify artist IDs
 * @returns {Promise<Array<string>>} List of genres
 */
async function getArtistGenres(artistIds) {
  const token = await getSpotifyToken();
  if (!token || !artistIds || artistIds.length === 0) return [];

  try {
    const ids = artistIds.slice(0, 50).join(",");
    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${ids}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      Log.warning("Failed to fetch artist genres", "", `status=${response.status}`);
      return [];
    }

    const data = await response.json();
    const allGenres = new Set();

    data.artists?.forEach((artist) => {
      if (artist?.genres) {
        artist.genres.forEach((genre) => allGenres.add(genre));
      }
    });

    return Array.from(allGenres);
  } catch (err) {
    Log.error("Error getting artist genres", err);
    return [];
  }
}

/**
 * Gets audio features for multiple tracks
 * @param {Array<string>} trackIds - Spotify track IDs
 * @returns {Promise<Map>} Map of track ID to audio features
 */
async function getAudioFeatures(trackIds) {
  const token = await getSpotifyToken();
  if (!token || !trackIds || trackIds.length === 0) return new Map();

  try {
    const ids = trackIds.join(",");
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      Log.warning("Failed to fetch audio features", "", `status=${response.status}`);
      return new Map();
    }

    const data = await response.json();
    const featuresMap = new Map();

    data.audio_features?.forEach((features) => {
      if (features) {
        featuresMap.set(features.id, {
          energy: features.energy,
          danceability: features.danceability,
          valence: features.valence,
          tempo: features.tempo,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
        });
      }
    });

    return featuresMap;
  } catch (err) {
    Log.error("Error getting audio features", err);
    return new Map();
  }
}

/**
 * Fetches recommendations using Spotify's search API with genre/artist filters
 * Note: The /recommendations endpoint was deprecated in November 2024
 * This alternative uses search with seed artist's related artists
 * @param {string} seedTrackId - Seed track ID
 * @param {number} limit - Number of recommendations
 * @param {Array<string>} targetGenres - Target genres (used for search filters)
 * @param {Object} targetFeatures - Target audio features (not used in search approach)
 * @returns {Promise<Array>} Spotify track results
 */
async function fetchSpotifyRecommendations(seedTrackId, limit = 10, targetGenres = [], targetFeatures = null) {
  const token = await getSpotifyToken();
  if (!token) return [];

  try {
    // First, get the seed track details to find the artist
    const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${seedTrackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!trackResponse.ok) {
      Log.warning("Failed to get seed track", "", `status=${trackResponse.status}`);
      return [];
    }

    const seedTrack = await trackResponse.json();
    const seedArtistId = seedTrack.artists?.[0]?.id;

    if (!seedArtistId) {
      Log.warning("No artist found for seed track");
      return [];
    }

    // Get the artist's top tracks as recommendations
    const topTracksResponse = await fetch(`https://api.spotify.com/v1/artists/${seedArtistId}/top-tracks?market=US`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let tracks = [];

    if (topTracksResponse.ok) {
      const topTracksData = await topTracksResponse.json();
      // Filter out the seed track itself
      tracks = (topTracksData.tracks || []).filter((t) => t.id !== seedTrackId);
    }

    // Also get related artists and their top tracks for variety
    const relatedResponse = await fetch(`https://api.spotify.com/v1/artists/${seedArtistId}/related-artists`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (relatedResponse.ok) {
      const relatedData = await relatedResponse.json();
      const relatedArtists = (relatedData.artists || []).slice(0, 3);

      // Get top track from each related artist
      for (const artist of relatedArtists) {
        const artistTopResponse = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (artistTopResponse.ok) {
          const artistTopData = await artistTopResponse.json();
          // Add first 2 tracks from each related artist
          tracks.push(...(artistTopData.tracks || []).slice(0, 2));
        }
      }
    }

    // If we have genre targets, also try genre-based search
    if (targetGenres.length > 0 && tracks.length < limit) {
      const genreQuery = targetGenres
        .slice(0, 2)
        .map((g) => `genre:"${g}"`)
        .join(" ");
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(genreQuery)}&type=track&limit=10&market=US`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const searchTracks = searchData.tracks?.items || [];
        // Add tracks not already in our list
        const existingIds = new Set(tracks.map((t) => t.id));
        for (const track of searchTracks) {
          if (!existingIds.has(track.id) && track.id !== seedTrackId) {
            tracks.push(track);
            existingIds.add(track.id);
          }
        }
      }
    }

    // Shuffle and limit
    const shuffled = tracks.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  } catch (err) {
    Log.error("Error getting Spotify recommendations", err);
    return [];
  }
}

module.exports = {
  getSpotifyToken,
  searchSpotifyTrack,
  getTrackDetails,
  getArtistGenres,
  getAudioFeatures,
  fetchSpotifyRecommendations,
};
