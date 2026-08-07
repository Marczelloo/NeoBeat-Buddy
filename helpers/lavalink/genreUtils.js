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

function normalizeGenre(genre) {
  return String(genre || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGenreFamilies(genres = []) {
  const families = new Set();

  for (const genre of genres) {
    const normalized = normalizeGenre(genre);
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
  const normalizedLeft = left.map(normalizeGenre).filter(Boolean);
  const normalizedRight = right.map(normalizeGenre).filter(Boolean);

  return normalizedLeft.filter((genre) =>
    normalizedRight.some((other) => genre === other || genre.includes(other) || other.includes(genre))
  );
}

module.exports = {
  normalizeGenre,
  getGenreFamilies,
  areGenreFamiliesCompatible,
  findGenreOverlap,
};
