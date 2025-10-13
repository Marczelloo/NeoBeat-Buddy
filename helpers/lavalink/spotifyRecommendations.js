const Log = require("../logs/log");

let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

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
 * Get detailed track information including audio features
 */
async function getTrackDetails(trackId) {
  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    // Fetch both track info and audio features in parallel
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

    // Extract release year from album
    const releaseDate = track.album?.release_date;
    const releaseYear = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;

    return {
      id: track.id,
      title: track.name,
      artist: track.artists[0]?.name || "Unknown",
      artistIds: track.artists.map((a) => a.id),
      popularity: track.popularity || 0,
      releaseYear,
      genres: [], // Will be populated from artist data
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
 * Get artist genres
 */
async function getArtistGenres(artistIds) {
  const token = await getSpotifyToken();
  if (!token || !artistIds || artistIds.length === 0) return [];

  try {
    // Spotify allows up to 50 artists per request
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
 * Get Spotify recommendations with genre and audio feature targeting
 */
async function getSpotifyRecommendations(seedTrackId, limit = 10, targetGenres = [], targetFeatures = null) {
  const token = await getSpotifyToken();
  if (!token) return [];

  try {
    // Build recommendation parameters
    const params = new URLSearchParams({
      seed_tracks: seedTrackId,
      limit: limit.toString(),
      market: "US",
    });

    // Add genre seeds if available (max 5 total seeds)
    if (targetGenres.length > 0) {
      const genreSeeds = targetGenres.slice(0, 2).join(",");
      params.append("seed_genres", genreSeeds);
    }

    // Add target audio features for better genre consistency
    if (targetFeatures) {
      if (targetFeatures.energy !== undefined) {
        params.append("target_energy", targetFeatures.energy.toFixed(2));
      }
      if (targetFeatures.danceability !== undefined) {
        params.append("target_danceability", targetFeatures.danceability.toFixed(2));
      }
      if (targetFeatures.valence !== undefined) {
        params.append("target_valence", targetFeatures.valence.toFixed(2));
      }
      if (targetFeatures.acousticness !== undefined) {
        params.append("target_acousticness", targetFeatures.acousticness.toFixed(2));
      }
      if (targetFeatures.tempo !== undefined) {
        params.append("target_tempo", Math.round(targetFeatures.tempo).toString());
      }
    }

    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      Log.warning("Spotify recommendations failed", "", `status=${response.status}`);
      return [];
    }

    const data = await response.json();
    const recommendations = data.tracks || [];

    // Get genres and audio features for all recommended tracks
    const artistIds = recommendations.flatMap((track) => track.artists.map((a) => a.id));
    const artistGenresMap = new Map();

    if (artistIds.length > 0) {
      const uniqueArtistIds = [...new Set(artistIds)];
      const response = await fetch(`https://api.spotify.com/v1/artists?ids=${uniqueArtistIds.slice(0, 50).join(",")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const artistData = await response.json();
        artistData.artists?.forEach((artist) => {
          if (artist) {
            artistGenresMap.set(artist.id, artist.genres || []);
          }
        });
      }
    }

    // Fetch audio features for all recommendations
    const trackIds = recommendations.map((t) => t.id).join(",");
    let audioFeaturesMap = new Map();

    if (trackIds) {
      const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (featuresResponse.ok) {
        const featuresData = await featuresResponse.json();
        featuresData.audio_features?.forEach((features) => {
          if (features) {
            audioFeaturesMap.set(features.id, {
              energy: features.energy,
              danceability: features.danceability,
              valence: features.valence,
              tempo: features.tempo,
              acousticness: features.acousticness,
              instrumentalness: features.instrumentalness,
            });
          }
        });
      }
    }

    Log.info(
      "Spotify recommendations fetched",
      "",
      `seed=${seedTrackId}`,
      `count=${recommendations.length}`,
      `targetGenres=${targetGenres.join(", ")}`,
      `targetTempo=${targetFeatures?.tempo ? Math.round(targetFeatures.tempo) : "none"}`,
      `artists=${recommendations
        .slice(0, 3)
        .map((t) => t.artists[0]?.name)
        .join(", ")}`
    );

    return recommendations.map((track) => {
      // Collect genres from all artists on this track
      const trackGenres = new Set();
      track.artists.forEach((artist) => {
        const genres = artistGenresMap.get(artist.id) || [];
        genres.forEach((g) => trackGenres.add(g));
      });

      // Extract release year
      const releaseDate = track.album?.release_date;
      const releaseYear = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;

      return {
        title: track.name,
        artist: track.artists[0]?.name || "Unknown",
        artistNames: track.artists.map((a) => a.name),
        artistIds: track.artists.map((a) => a.id),
        genres: Array.from(trackGenres),
        spotifyId: track.id,
        popularity: track.popularity || 0,
        releaseYear,
        features: audioFeaturesMap.get(track.id) || null,
      };
    });
  } catch (err) {
    Log.error("Error getting Spotify recommendations", err);
    return [];
  }
}

async function getSpotifyBasedSuggestions(referenceTrack) {
  if (!referenceTrack?.info) return [];

  const { title, author } = referenceTrack.info;

  const trackId = await searchSpotifyTrack(title, author);

  if (!trackId) {
    Log.warning("Could not find reference track on Spotify", "", `title=${title}`, `artist=${author}`);
    return [];
  }

  const recommendations = await getSpotifyRecommendations(trackId, 5);

  return recommendations;
}

module.exports = {
  getSpotifyBasedSuggestions,
  getSpotifyRecommendations,
  searchSpotifyTrack,
  getTrackDetails,
  getArtistGenres,
};
