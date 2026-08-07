const { getSearchPrefix } = require("./searchSources");

const CACHE_TTL_MS = 15_000;
const MAX_RESULTS_PER_SOURCE = 10;
const SOURCE_TIMEOUT_MS = 1_500;
const searchCache = new Map();

function normalizeCacheQuery(query) {
  return String(query || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function searchSource(poru, query, source) {
  const prefix = getSearchPrefix(source);
  const result = await poru.resolve({ query: `${prefix}:${query}` });
  return Array.isArray(result?.tracks) ? result.tracks.slice(0, MAX_RESULTS_PER_SOURCE) : [];
}

function searchSourceWithTimeout(poru, query, source) {
  return Promise.race([
    searchSource(poru, query, source),
    new Promise((resolve) => setTimeout(() => resolve([]), SOURCE_TIMEOUT_MS)),
  ]);
}

/**
 * Searches every free provider in parallel. The selected source remains the
 * playback preference, but autocomplete ranks the combined result pool by
 * artist/title accuracy and popularity instead of hiding good matches from
 * another provider.
 */
async function searchAcrossSources(poru, query, { preferredSource = "deezer" } = {}) {
  const normalizedQuery = normalizeCacheQuery(query);
  if (!poru || !normalizedQuery) return [];

  const cacheKey = `${preferredSource}:${normalizedQuery}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.tracks;

  const allSources = ["deezer", "youtube", "spotify", "soundcloud"];
  const sources = [preferredSource, ...allSources.filter((source) => source !== preferredSource)];
  const settled = await Promise.allSettled(
    sources.map((source) => searchSourceWithTimeout(poru, query, source))
  );
  const tracks = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  searchCache.set(cacheKey, { timestamp: Date.now(), tracks });
  return tracks;
}

function clearSearchCache() {
  searchCache.clear();
}

module.exports = {
  CACHE_TTL_MS,
  MAX_RESULTS_PER_SOURCE,
  clearSearchCache,
  searchAcrossSources,
};
