const GENERIC_SEARCH_WORDS = new Set([
  "a",
  "an",
  "and",
  "audio",
  "edition",
  "hd",
  "official",
  "original",
  "song",
  "the",
  "video",
  "lyrics",
  "music",
]);

const VERSION_WORDS = new Set([
  "acoustic",
  "cover",
  "live",
  "mix",
  "nightcore",
  "remix",
  "spedup",
  "slowed",
  "karaoke",
  "instrumental",
  "8d",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(?:dzsearch|ytsearch|spsearch|ytmsearch):\s*/i, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value, { keepGeneric = false } = {}) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => keepGeneric || !GENERIC_SEARCH_WORDS.has(token));
}

function getUniqueTokens(value, options) {
  return [...new Set(getTokens(value, options))];
}

function getCoverage(needleTokens, candidateTokens) {
  if (!needleTokens.length) return 0;

  const candidateSet = new Set(candidateTokens);
  const matches = needleTokens.filter((token) => candidateSet.has(token)).length;
  return matches / needleTokens.length;
}

function getPopularity(track) {
  const candidates = [
    track?.popularity,
    track?.info?.popularity,
    track?.pluginInfo?.popularity,
    track?.userData?.popularity,
  ];

  const popularity = candidates.find((value) => Number.isFinite(Number(value)));
  if (popularity === undefined) return 0;

  const numeric = Number(popularity);
  return Math.max(0, Math.min(numeric <= 1 ? numeric * 100 : numeric, 100));
}

function splitExplicitQuery(query) {
  const match = String(query || "")
    .trim()
    .match(/^(.+?)\s[-–—|]\s(.+)$/);

  if (!match) return null;

  return {
    artist: getUniqueTokens(match[1]),
    title: getUniqueTokens(match[2]),
  };
}

function getVersionTokens(title) {
  return getUniqueTokens(title, { keepGeneric: true }).filter((token) => VERSION_WORDS.has(token));
}

function scoreSearchResult(track, query, index = 0) {
  const title = track?.info?.title || "";
  const author = track?.info?.author || "";
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);
  const candidateText = `${normalizedAuthor} ${normalizedTitle}`.trim();
  const queryTokens = getUniqueTokens(query);
  const titleTokens = getUniqueTokens(title);
  const authorTokens = getUniqueTokens(author);
  const explicitQuery = splitExplicitQuery(query);
  const popularity = getPopularity(track);

  let score = 0;
  const reasons = [];

  if (normalizedTitle === normalizedQuery || normalizedAuthor === normalizedQuery) {
    score += 180;
    reasons.push("exact field");
  }

  if (candidateText === normalizedQuery || `${normalizedTitle} ${normalizedAuthor}` === normalizedQuery) {
    score += 180;
    reasons.push("exact artist/title");
  }

  if (normalizedQuery && candidateText.includes(normalizedQuery)) {
    score += 65;
    reasons.push("query phrase");
  }

  if (explicitQuery) {
    const artistCoverage = getCoverage(explicitQuery.artist, authorTokens);
    const titleCoverage = getCoverage(explicitQuery.title, titleTokens);

    score += artistCoverage * 105;
    score += titleCoverage * 145;

    if (artistCoverage === 1 && explicitQuery.artist.length) reasons.push("artist match");
    if (titleCoverage === 1 && explicitQuery.title.length) reasons.push("title match");
  } else {
    const titleCoverage = getCoverage(queryTokens, titleTokens);
    const authorCoverage = getCoverage(queryTokens, authorTokens);
    const combinedCoverage = getCoverage(queryTokens, [...authorTokens, ...titleTokens]);

    score += titleCoverage * 135;
    score += authorCoverage * 80;
    score += combinedCoverage * 95;

    if (titleCoverage > 0) reasons.push("title tokens");
    if (authorCoverage > 0) reasons.push("artist tokens");
  }

  const unwantedVersions = getVersionTokens(title).filter(
    (token) => !getTokens(query, { keepGeneric: true }).includes(token)
  );
  if (unwantedVersions.length) {
    score -= unwantedVersions.length * 18;
    reasons.push(`version penalty:${unwantedVersions.join(",")}`);
  }

  // Lavalink does not expose popularity consistently across all sources. When it does,
  // use it as a small tie-breaker; otherwise the provider's result order remains useful.
  score += popularity * 0.12;
  score -= index * 0.08;

  return {
    track,
    index,
    popularity,
    score,
    reasons,
  };
}

function rankSearchResults(tracks, query, { limit, withScores = false } = {}) {
  const ranked = (Array.isArray(tracks) ? tracks : [])
    .map((track, index) => scoreSearchResult(track, query, index))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.popularity !== left.popularity) return right.popularity - left.popularity;
      return left.index - right.index;
    });

  const selected = Number.isInteger(limit) ? ranked.slice(0, Math.max(0, limit)) : ranked;
  return withScores ? selected : selected.map((entry) => entry.track);
}

module.exports = {
  getPopularity,
  normalizeText,
  rankSearchResults,
  scoreSearchResult,
};
