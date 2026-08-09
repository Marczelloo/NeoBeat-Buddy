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

const {
  getBaseTitle,
  getVariantKinds,
  isUnrequestedAlternateVersion,
  normalizeComparableText,
  queryRequestsVariant,
} = require("./trackNormalization");

const VERSION_PENALTIES = Object.freeze({
  remix: 70,
  nightcore: 70,
  slowed: 70,
  spedup: 70,
  live: 55,
  instrumental: 65,
  karaoke: 80,
  cover: 70,
  acoustic: 55,
  mix: 50,
  edit: 35,
  single: 0,
  version: 0,
  original: 0,
  radio: 0,
  clean: 0,
  explicit: 0,
  remaster: 20,
});

const NON_MUSIC_SEARCH_PATTERNS = [
  /\b(?:tutorial|how to|lesson|tips?|tricks?|review|reaction|reacts?|analysis|explained)\b/i,
  /\b(?:interview|podcast|gameplay|walkthrough|speedrun|stream(?:ed)?\s+sniped|livestream)\b/i,
  /\b(?:clip|highlights?|trailer|teaser|unboxing|school|class|contest|setup|testing)\b/i,
  /\b(?:royalty\s+free|shopping\s+spree|teaches?|dub|prank|challenge|asmr|mukbang)\b/i,
];

function normalizeText(value) {
  return normalizeComparableText(value);
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
  const popularityCandidates = [
    [track?.popularity, false],
    [track?.info?.popularity, false],
    [track?.pluginInfo?.popularity, false],
    [track?.userData?.popularity, false],
    [track?.info?.viewCount, true],
    [track?.info?.views, true],
    [track?.pluginInfo?.viewCount, true],
    [track?.pluginInfo?.views, true],
    [track?.userData?.viewCount, true],
    [track?.userData?.views, true],
  ];

  const candidate = popularityCandidates.find(([value]) => Number.isFinite(Number(value)));
  if (!candidate) return 0;

  const [value, isViewCount] = candidate;
  const numeric = Number(value);
  if (isViewCount) {
    // YouTube/Lavalink often exposes views instead of a 0-100 popularity.
    // Logarithmic scaling prevents a viral track from overpowering exact
    // artist/title matches while still making popularity useful as a tie-break.
    return Math.max(0, Math.min(100, Math.log10(Math.max(1, numeric)) * 10));
  }

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
  return getVariantKinds(title);
}

function getCanonicalTitle(title) {
  return getBaseTitle(title);
}

function getProviderIdentity(track) {
  const source = normalizeText(track?.info?.sourceName || track?.info?.source || "");
  return source || "unknown";
}

function getConsensusKey(track) {
  const title = normalizeText(track?.info?.title || "");
  const author = normalizeText(track?.info?.author || "");
  if (!title || !author) return null;
  return `${author}|||${title}`;
}

function getProviderConsensus(track, consensusMap) {
  const key = getConsensusKey(track);
  if (!key || !consensusMap) return 0;
  return consensusMap.get(key)?.size ?? 0;
}

function scoreSearchResult(track, query, index = 0, { consensusMap } = {}) {
  const title = track?.info?.title || "";
  const author = track?.info?.author || "";
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const canonicalTitle = getCanonicalTitle(title);
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

  if (canonicalTitle && canonicalTitle === normalizedQuery && normalizedTitle !== normalizedQuery) {
    // Prefer the official single/radio/remaster variant of a well-known song
    // over an unrelated cover with the same bare title.
    score += 185;
    reasons.push("canonical title");
  }

  if (
    queryTokens.length >= 2 &&
    normalizedAuthor &&
    normalizedTitle &&
    normalizedQuery !== normalizedTitle &&
    normalizedQuery !== normalizedAuthor &&
    (candidateText === normalizedQuery || `${normalizedTitle} ${normalizedAuthor}` === normalizedQuery)
  ) {
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
    const authorSet = new Set(authorTokens);
    const titleTokensAfterArtist = queryTokens.filter((token) => !authorSet.has(token));
    const titleAfterArtistCoverage = getCoverage(titleTokensAfterArtist, titleTokens);

    score += titleCoverage * 135;
    score += authorCoverage * 80;
    score += combinedCoverage * 95;

    // For a query such as "kuki cieple dranie", prefer the candidate whose
    // metadata splits into artist=Kuki and title=Ciepłe Dranie. This prevents
    // a SoundCloud upload titled "KUKI CIEPŁE DRANIE" by another uploader from
    // outranking the actual Deezer/Spotify recording.
    if (authorCoverage > 0 && titleTokensAfterArtist.length > 0 && titleAfterArtistCoverage === 1) {
      score += 180 + authorCoverage * 40;
      reasons.push("artist/title split");
    }

    // A multi-word query represented only by the title is ambiguous. Keep it
    // available, but let an artist/title split or trusted provider order win.
    if (queryTokens.length >= 3 && titleCoverage === 1 && authorCoverage === 0) {
      score -= 45;
      reasons.push("title-only ambiguity");
    }

    if (titleCoverage > 0) reasons.push("title tokens");
    if (authorCoverage > 0) reasons.push("artist tokens");
  }

  const unwantedVersions = getVersionTokens(title).filter((kind) => !queryRequestsVariant(query, title) || !getVersionTokens(query).includes(kind));
  if (unwantedVersions.length) {
    const penalty = unwantedVersions.reduce((sum, token) => sum + (VERSION_PENALTIES[token] ?? 25), 0);
    score -= penalty;
    reasons.push(`version penalty:${unwantedVersions.join(",")}`);
  }

  if (!normalizedAuthor && queryTokens.length > 0) {
    score -= 45;
    reasons.push("unknown uploader");
  }

  const consensusSources = getProviderConsensus(track, consensusMap);
  if (consensusSources > 1) {
    score += (consensusSources - 1) * 32;
    reasons.push(`provider consensus:${consensusSources}`);
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

function isLikelyNonMusicSearchResult(track) {
  const haystack = normalizeText(`${track?.info?.title || ""} ${track?.info?.author || ""}`);
  return NON_MUSIC_SEARCH_PATTERNS.some((pattern) => pattern.test(haystack));
}

function isRelevantSearchResult(track, query) {
  if (!track?.info || isLikelyNonMusicSearchResult(track)) return false;

  const queryTokens = getUniqueTokens(query);
  // Queries made entirely from generic words (for example just "the") do
  // not have enough signal to filter safely. A real one-word query still
  // needs to occur in the candidate metadata.
  if (!queryTokens.length) return true;

  const candidateTokens = getUniqueTokens(`${track.info.author || ""} ${track.info.title || ""}`);
  const coverage = getCoverage(queryTokens, candidateTokens);

  if (queryTokens.length === 1) return coverage === 1;

  // A multi-word music query should be represented by all meaningful words.
  // This removes YouTube clips that merely contain one word such as "hit".
  return coverage >= (queryTokens.length >= 3 ? 1 : 0.75);
}

function filterRelevantSearchResults(tracks, query) {
  return (Array.isArray(tracks) ? tracks : []).filter((track) => isRelevantSearchResult(track, query));
}

// Relevance is deliberately separate from playability: callers that are about
// to start playback must never use an acoustic/live/remix upload as the
// implicit substitute for a base-version search.
function filterPlayableSearchResults(tracks, query) {
  return filterRelevantSearchResults(tracks, query).filter(
    (track) => !isUnrequestedAlternateVersion(track?.info?.title, query)
  );
}

function rankSearchResults(tracks, query, { limit, withScores = false } = {}) {
  const sourceConsensus = new Map();
  for (const track of Array.isArray(tracks) ? tracks : []) {
    const key = getConsensusKey(track);
    if (!key) continue;

    if (!sourceConsensus.has(key)) sourceConsensus.set(key, new Set());
    sourceConsensus.get(key).add(getProviderIdentity(track));
  }

  const ranked = (Array.isArray(tracks) ? tracks : [])
    .map((track, index) => scoreSearchResult(track, query, index, { consensusMap: sourceConsensus }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.popularity !== left.popularity) return right.popularity - left.popularity;
      return left.index - right.index;
    });

  const selected = Number.isInteger(limit) ? ranked.slice(0, Math.max(0, limit)) : ranked;
  return withScores ? selected : selected.map((entry) => entry.track);
}

module.exports = {
  getCanonicalTitle,
  getConsensusKey,
  filterRelevantSearchResults,
  filterPlayableSearchResults,
  getPopularity,
  getProviderConsensus,
  getProviderIdentity,
  isLikelyNonMusicSearchResult,
  isRelevantSearchResult,
  normalizeText,
  rankSearchResults,
  scoreSearchResult,
};
