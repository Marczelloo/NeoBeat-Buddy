const Log = require("../logs/log");
const { normalizeGenreTags } = require("./genreUtils");

const tagCache = new Map();
const TAG_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function getCacheKey(artist, title, limit) {
  return `${String(artist || "").trim().toLowerCase()}|${String(title || "").trim().toLowerCase()}|${Number(limit) || 0}`;
}

async function callLastFm(params) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;

  const query = new URLSearchParams({ ...params, api_key: apiKey, format: "json", autocorrect: "1" });
  const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${query}`);
  if (!response.ok) return null;
  return response.json();
}

async function getLastFmSimilarTracks({ artist, title, limit = 10 } = {}) {
  if (!process.env.LASTFM_API_KEY || !artist || !title) return [];

  try {
    const data = await callLastFm({
      method: "track.getsimilar",
      artist,
      track: title,
      limit: String(limit),
    });
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

/**
 * Gets the community tags attached to one exact recording. Tags are cached
 * because autoplay asks for the same reference tracks repeatedly while it
 * prefetches the next entry in a room.
 */
async function getLastFmTrackTags({ artist, title, limit = 8 } = {}) {
  if (!process.env.LASTFM_API_KEY || !artist || !title) return [];

  const cacheKey = getCacheKey(artist, title, limit);
  const cached = tagCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TAG_CACHE_TTL_MS) return cached.tags;

  try {
    const data = await callLastFm({
      method: "track.gettoptags",
      artist,
      track: title,
      // Pull a wider raw pool before dropping non-musical community labels;
      // otherwise a top-eight response full of "seen live" style tags can
      // erase every usable genre signal.
      limit: String(Math.max(Number(limit) * 3, 24)),
    });
    const tags = (data?.toptags?.tag || [])
      .filter((tag) => tag?.name)
      .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
      .map((tag) => String(tag.name).trim())
      .filter(Boolean);

    const normalizedTags = normalizeGenreTags(tags, { artist, title }).slice(0, limit);

    tagCache.set(cacheKey, { timestamp: Date.now(), tags: normalizedTags });
    return normalizedTags;
  } catch (error) {
    Log.debug("Last.fm tag lookup failed", error.message);
    return [];
  }
}

function clearLastFmTagCache() {
  tagCache.clear();
}

module.exports = { getLastFmSimilarTracks, getLastFmTrackTags, clearLastFmTagCache };
