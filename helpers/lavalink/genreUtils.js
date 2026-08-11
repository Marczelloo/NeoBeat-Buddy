const FAMILY_RULES = [
  ["hiphop", /\b(hip[ -]?hop|rap|trap|drill|grime|boom bap|cloud rap|emo rap)\b/i],
  ["metal", /\b(metal|metalcore|deathcore|nu metal|doom metal|black metal|thrash metal|power metal)\b/i],
  ["rock", /\b(rock|alternative|indie|punk|grunge|emo|post[ -]?rock|shoegaze|hard rock)\b/i],
  ["electronic", /\b(electronic|edm|house|techno|trance|dubstep|drum and bass|dnb|electro|synthwave|hyperpop)\b/i],
  ["pop", /\b(pop|dance pop|electropop|teen pop|art pop|bedroom pop)\b/i],
  ["rnb", /\b(r&b|rnb|soul|neo soul|funk|motown)\b/i],
  ["jazz", /\b(jazz|bebop|swing|blues|fusion)\b/i],
  ["classical", /\b(classical|baroque|orchestral|opera|piano)\b/i],
  ["country", /\b(country|bluegrass|americana|folk)\b/i],
  ["latin", /\b(latin|reggaeton|salsa|bachata|cumbia)\b/i],
  ["reggae", /\b(reggae|dancehall|dub|ska)\b/i],
  ["kpop", /\b(k[ -]?pop|korean pop)\b/i],
  ["jpop", /\b(j[ -]?pop|japanese pop|city pop)\b/i],
];

const COMPATIBLE_FAMILIES = new Set([
  "electronic:hiphop",
  "electronic:pop",
  "electronic:rock",
  "hiphop:rnb",
  "hiphop:pop",
  "jpop:pop",
  "kpop:pop",
  "metal:rock",
  "pop:rnb",
  "jazz:rnb",
  "rnb:funk",
  "latin:reggae",
]);

const GENRE_ALIASES = [
  [/\br\s*(?:and|n)\s*b\b|\brnb\b/gi, "rnb"],
  [/\bhip[\s-]?hop\b/gi, "hiphop"],
  [/\bsynth[\s-]?pop\b/gi, "synthpop"],
  [/\belectro[\s-]?pop\b/gi, "electropop"],
  [/\bdrum\s*(?:and|n)\s*bass\b/gi, "dnb"],
  [/\bk[\s-]?pop\b/gi, "kpop"],
  [/\bj[\s-]?pop\b/gi, "jpop"],
];

const NON_MUSIC_TAG_PATTERN = /^(?:\d{4}s?|\d{2}s|\d{4}\s+music|seen\s+live|favorite(?:s)?|favourites?|my\s+(?:favorites?|favourites?|music|shit)|female\s+vocalists?|male\s+vocalists?|under\s+\d+\s+listeners|awesome|love|loved|beautiful|cool|best|good|bad|spotify|last\s*fm|scrobble(?:d)?|heard\s+on|playlist|indie\s+playlist|english|polish|american|british|german|french|swedish|canadian)$/i;

function isNoisyGenreTag(genre) {
  const tag = normalizeGenre(genre);
  if (!tag) return true;

  // Last.fm also returns listener-made sentences, radio names and playlist
  // fragments. They are useful for discovery, but too unstable to steer DJ
  // transitions or build a session profile.
  if (tag.length > 32 || tag.split(" ").length > 4) return true;
  if (/\b(?:fm|radio|listeners?|scrobble|playlist|station|channel)\b/i.test(tag)) return true;
  if (/\d/.test(tag) && !/^\d{4}s?$/.test(tag)) return true;
  if (/^(?:my|the)\s+(?:pussy|favorite|favourite|personal|own)\b/i.test(tag)) return true;

  return false;
}

function normalizeGenre(genre) {
  let normalized = String(genre || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[._/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of GENRE_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function isContextTag(genre, context = {}) {
  const tag = normalizeGenre(genre);
  if (!tag) return false;

  const contextValues = [context.artist, context.title]
    .map(normalizeGenre)
    .filter((value) => value.length >= 4);

  return contextValues.some((value) => tag === value || (tag.length >= 6 && value.includes(tag)) || (value.length >= 6 && tag.includes(value)));
}

function normalizeGenreTags(genres = [], context = {}) {
  const unique = new Set();

  for (const genre of Array.isArray(genres) ? genres : []) {
    const normalized = normalizeGenre(genre);
    if (
      !normalized ||
      NON_MUSIC_TAG_PATTERN.test(normalized) ||
      isNoisyGenreTag(normalized) ||
      isContextTag(normalized, context)
    )
      continue;
    unique.add(normalized);
  }

  return [...unique];
}

function getGenreFamilies(genres = []) {
  const families = new Set();

  for (const genre of normalizeGenreTags(genres)) {
    const normalized = genre;
    for (const [family, pattern] of FAMILY_RULES) {
      if (pattern.test(normalized)) families.add(family);
    }
  }

  return [...families];
}

function areGenreFamiliesCompatible(left = [], right = []) {
  if (!left.length || !right.length) return null;

  if (left.some((family) => right.includes(family))) return true;

  return left.some((leftFamily) =>
    right.some((rightFamily) => {
      const pair = [leftFamily, rightFamily].sort().join(":");
      return COMPATIBLE_FAMILIES.has(pair);
    })
  );
}

function findGenreOverlap(left = [], right = []) {
  const normalizedLeft = normalizeGenreTags(left);
  const normalizedRight = normalizeGenreTags(right);

  return normalizedLeft.filter((genre) =>
    normalizedRight.some((other) => genre === other || genre.includes(other) || other.includes(genre))
  );
}

module.exports = {
  normalizeGenre,
  normalizeGenreTags,
  isNoisyGenreTag,
  getGenreFamilies,
  areGenreFamiliesCompatible,
  findGenreOverlap,
};
