const { getSearchPrefix } = require("./searchSources");

const CACHE_TTL_MS = 15_000;
const MAX_RESULTS_PER_SOURCE = 50;
const SOURCE_TIMEOUT_MS = 1_500;
const searchCache = new Map();

// YouTube Music is usually better for songs, while regular YouTube has a
// wider catalogue. Query both so a missing/blocked YTM result cannot hide a
// valid regular YouTube result.
const SEARCH_VARIANTS = Object.freeze({
  deezer: ["dzsearch"],
  youtube: ["ytmsearch", "ytsearch"],
  spotify: ["spsearch"],
  soundcloud: ["scsearch"],
});

function normalizeCacheQuery(query) {
  return String(query || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function searchSource(poru, query, source) {
  const prefixes = SEARCH_VARIANTS[source] || [getSearchPrefix(source)];
  const settled = await Promise.allSettled(
    // Poru prepends its default platform when a source is not passed. Put
    // the Lavalink search prefix in `source`, otherwise `dzsearch:foo` turns
    // into a real request for `ytsearch:dzsearch:foo`.
    prefixes.map((prefix) => poru.resolve({ query, source: prefix }))
  );

  return settled
    .flatMap((result) => (result.status === "fulfilled" && Array.isArray(result.value?.tracks) ? result.value.tracks : []))
    .slice(0, MAX_RESULTS_PER_SOURCE);
}

function searchSourceWithTimeout(poru, query, source) {
  return Promise.race([
    searchSource(poru, query, source),
    new Promise((resolve) => setTimeout(() => resolve([]), SOURCE_TIMEOUT_MS)),
  ]);
}

/**
 * Queries one provider only. Activity search uses this to avoid mixing a
 * loosely related result from another provider into an otherwise good list.
 */
async function searchSingleSource(poru, query, source) {
  const normalizedQuery = normalizeCacheQuery(query);
  if (!poru || !normalizedQuery) return [];

  const normalizedSource = SEARCH_VARIANTS[source] ? source : "youtube";
  const cacheKey = `single:${normalizedSource}:${normalizedQuery}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.tracks;

  const tracks = await searchSourceWithTimeout(poru, query, normalizedSource);
  searchCache.set(cacheKey, { timestamp: Date.now(), tracks });
  return tracks;
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
  SEARCH_VARIANTS,
  clearSearchCache,
  searchSingleSource,
  searchAcrossSources,
};
