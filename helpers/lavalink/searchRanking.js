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
  "album",
  "cover",
  "clean",
  "dirty",
  "edit",
  "explicit",
  "live",
  "mix",
  "nightcore",
  "original",
  "radio",
  "remaster",
  "remix",
  "single",
  "spedup",
  "slowed",
  "karaoke",
  "instrumental",
  "version",
  "8d",
]);

const NON_MUSIC_SEARCH_PATTERNS = [
  /\b(?:tutorial|how to|lesson|tips?|tricks?|review|reaction|reacts?|analysis|explained)\b/i,
  /\b(?:interview|podcast|gameplay|walkthrough|speedrun|stream(?:ed)?\s+sniped|livestream)\b/i,
  /\b(?:clip|highlights?|trailer|teaser|unboxing|school|class|contest|setup|testing)\b/i,
  /\b(?:royalty\s+free|shopping\s+spree|teaches?|dub|prank|challenge|asmr|mukbang)\b/i,
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // NFKD does not decompose every letter used in song titles (notably
    // Polish ł), so make keyboard-friendly queries match provider metadata.
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/^(?:dzsearch|ytsearch|spsearch|ytmsearch):\s*/i, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&/g, " and ")
    // Preserve non-Latin artist names so a title-only query is not mistaken
    // for an exact artist/title match when the artist is written in Cyrillic.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
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
  return getUniqueTokens(title, { keepGeneric: true }).filter((token) => VERSION_WORDS.has(token));
}

function getCanonicalTitle(title) {
  return getUniqueTokens(title, { keepGeneric: true })
    .filter((token) => !VERSION_WORDS.has(token))
    .join(" ");
}

function scoreSearchResult(track, query, index = 0) {
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

  const unwantedVersions = getVersionTokens(title).filter(
    (token) => !getTokens(query, { keepGeneric: true }).includes(token)
  );
  if (unwantedVersions.length && canonicalTitle !== normalizedQuery) {
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
  getCanonicalTitle,
  filterRelevantSearchResults,
  getPopularity,
  isLikelyNonMusicSearchResult,
  isRelevantSearchResult,
  normalizeText,
  rankSearchResults,
  scoreSearchResult,
};
