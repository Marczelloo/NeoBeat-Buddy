const Log = require("../logs/log");

async function getLastFmSimilarTracks({ artist, title, limit = 10 } = {}) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey || !artist || !title) return [];

  try {
    const params = new URLSearchParams({
      method: "track.getsimilar",
      artist,
      track: title,
      api_key: apiKey,
      format: "json",
      limit: String(limit),
      autocorrect: "1",
    });
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    return (data?.similartracks?.track || [])
      .filter((track) => track?.name && track?.artist?.name)
      .map((track) => ({
        title: track.name,
        artist: track.artist.name,
        match: Number(track.match) || 0,
      }));
  } catch (error) {
    Log.debug("Last.fm similar-track lookup failed", error.message);
    return [];
  }
}

module.exports = { getLastFmSimilarTracks };
