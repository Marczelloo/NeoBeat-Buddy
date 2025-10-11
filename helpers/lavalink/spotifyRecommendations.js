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
 * Get Spotify recommendations based on a seed track
 */
async function getSpotifyRecommendations(seedTrackId, limit = 5) {
  const token = await getSpotifyToken();
  if (!token) return [];

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTrackId}&limit=${limit}&market=US`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      Log.warning("Spotify recommendations failed", "", `status=${response.status}`);
      return [];
    }

    const data = await response.json();
    const recommendations = data.tracks || [];

    Log.info(
      "Spotify recommendations fetched",
      "",
      `seed=${seedTrackId}`,
      `count=${recommendations.length}`,
      `artists=${recommendations
        .slice(0, 3)
        .map((t) => t.artists[0]?.name)
        .join(", ")}`
    );

    return recommendations.map((track) => ({
      title: track.name,
      artist: track.artists[0]?.name || "Unknown",
      artistNames: track.artists.map((a) => a.name),
    }));
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
};
