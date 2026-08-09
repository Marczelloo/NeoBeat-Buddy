const PRESENTATION_LABEL_PATTERN = /^(?:official(?:\s+(?:music\s+)?(?:video|audio|mv|lyric\s+video))?|lyrics?|lyric\s+video|audio|video|visuali[sz]er|hq|hd|4k|8k)$/i;
const NEUTRAL_TITLE_LABEL_PATTERN = /^(?:original|original\s+version|single(?:\s+version)?|album(?:\s+version)?|clean|explicit)\s*$/i;
const TRAILING_VARIANT_LABEL_PATTERN = /^(.*?)(?:\s+)(?:remix|remixed|rework|bootleg|acoustic|unplugged|stripped|demo|rehearsal|cover|tribute|instrumental|karaoke|nightcore|slowed|sped\s*up|speed\s*up|chopped\s*(?:and\s*)?(?:screwed|slopped)|choppednotslopped|radio\s*edit|extended(?:\s+(?:mix|version))?|club\s+mix|dj\s+mix|remaster(?:ed)?|anniversary\s+edition)(?:\s+(?:version|mix))?\s*$/i;

const VARIANT_DEFINITIONS = [
  ["remix", /\b(?:remix|remixed|rework|bootleg)\b/i],
  ["live", /\b(?:live(?:\s+(?:version|performance|session|at|from))?|concert\s+version|concert)\b/i],
  ["acoustic", /\b(?:acoustic|unplugged|stripped|piano\s+version|orchestral\s+version)\b/i],
  ["demo", /\b(?:demo|rehearsal|rough\s+mix|early\s+version)\b/i],
  ["cover", /\b(?:cover|tribute)\b/i],
  ["instrumental", /\b(?:instrumental|karaoke|backing\s+track)\b/i],
  ["tempo", /\b(?:nightcore|slowed(?:\s*(?:\+|and)\s*reverb)?|sped\s*up|speed\s*up)\b/i],
  ["chopped", /\b(?:chopped\s*(?:and\s*)?(?:screwed|slopped)|choppednotslopped)\b/i],
  ["edit", /\b(?:radio\s*edit|extended(?:\s+(?:mix|version))?|club\s+mix|dj\s+mix|edit)\b/i],
  ["remaster", /\b(?:remaster(?:ed)?|anniversary\s+edition)\b/i],
];

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/^(?:dzsearch|ytsearch|spsearch|scsearch|ytmsearch):\s*/i, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanArtistName(value) {
  return String(value || "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/(?:\s|-)*(?:official\s+artist\s+channel|topic|vevo|records?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDecoratedSegments(value) {
  const title = String(value || "").trim();
  const segments = [];

  for (const match of title.matchAll(/(?:\[([^\]]+)\]|\(([^)]+)\))/g)) {
    const segment = (match[1] || match[2] || "").trim();
    if (segment) segments.push({ value: segment, start: match.index, end: match.index + match[0].length });
  }

  const suffix = title.match(/\s[-–—|]\s([^–—|]+)$/);
  if (suffix?.[1]?.trim()) {
    const start = title.length - suffix[0].length;
    segments.push({ value: suffix[1].trim(), start, end: title.length });
  }

  return segments;
}

function getVariantKinds(value) {
  const title = String(value || "").trim();
  const segments = getDecoratedSegments(title).map((segment) => segment.value);
  const trailing = title.match(/\b(?:remix|remixed|rework|bootleg|acoustic|unplugged|stripped|demo|rehearsal|cover|tribute|instrumental|karaoke|nightcore|slowed|sped\s*up|speed\s*up|chopped\s*(?:and\s*)?(?:screwed|slopped)|choppednotslopped|radio\s*edit|extended(?:\s+(?:mix|version))?|club\s+mix|dj\s+mix|remaster(?:ed)?|anniversary\s+edition)(?:\s+(?:version|mix))?\s*$/i);
  if (trailing) segments.push(trailing[0]);

  const kinds = new Set();
  for (const segment of segments) {
    for (const [kind, pattern] of VARIANT_DEFINITIONS) {
      if (pattern.test(segment)) kinds.add(kind);
    }
  }

  return [...kinds];
}

function stripPresentationNoise(value) {
  let title = String(value || "").trim();
  let previous;

  do {
    previous = title;
    title = title
      .replace(/\s*(?:\[([^\]]+)\]|\(([^)]+)\))/g, (match, squareLabel, roundLabel) => {
        const label = (squareLabel || roundLabel || "").trim();
        return PRESENTATION_LABEL_PATTERN.test(label) ? "" : match;
      })
      .replace(/\s[-–—|]\s*(official(?:\s+(?:music\s+)?(?:video|audio|mv|lyric\s+video))?|lyrics?|lyric\s+video|audio|video|visuali[sz]er|hq|hd|4k|8k)\s*$/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/[\s-–—|]+$/g, "")
      .trim();
  } while (title !== previous);

  return title;
}

function stripVariantDecorators(value) {
  let title = stripPresentationNoise(value);
  const removable = getDecoratedSegments(title)
    .filter((segment) => getVariantKinds(segment.value).length > 0 || NEUTRAL_TITLE_LABEL_PATTERN.test(segment.value.trim()))
    .sort((left, right) => right.start - left.start);

  for (const segment of removable) {
    title = `${title.slice(0, segment.start)}${title.slice(segment.end)}`.replace(/\s{2,}/g, " ").trim();
  }

  const trailingVariant = title.match(TRAILING_VARIANT_LABEL_PATTERN);
  if (trailingVariant?.[1]?.trim()) title = trailingVariant[1].trim();

  return title.replace(/[\s-–—|]+$/g, "").trim();
}

function getBaseTitle(value) {
  return normalizeComparableText(stripVariantDecorators(value));
}

function queryRequestsVariant(query, candidateTitle) {
  const requested = getVariantKinds(query);
  const candidate = getVariantKinds(candidateTitle);
  if (!candidate.length) return false;
  if (!requested.length) return false;
  return candidate.every((kind) => requested.includes(kind));
}

function isUnrequestedAlternateVersion(candidateTitle, query) {
  const candidateKinds = getVariantKinds(candidateTitle);
  if (!candidateKinds.length) return false;
  return !queryRequestsVariant(query, candidateTitle);
}

function cleanTrackMetadata(title, author) {
  const rawTitle = String(title || "").trim();
  const suppliedArtist = cleanArtistName(author);
  const parts = rawTitle.split(/\s[-–—]\s/);
  let searchArtist = suppliedArtist;
  let cleanTitle = rawTitle;

  if (parts.length >= 2) {
    const prefix = cleanArtistName(parts[0]);
    const normalizedPrefix = normalizeComparableText(prefix).replace(/\s/g, "");
    const normalizedArtist = normalizeComparableText(suppliedArtist).replace(/\s/g, "");
    if (!normalizedArtist || normalizedPrefix === normalizedArtist) {
      searchArtist = prefix || suppliedArtist;
      cleanTitle = parts.slice(1).join(" - ").trim();
    }
  }

  return {
    cleanTitle: stripVariantDecorators(cleanTitle),
    searchArtist: cleanArtistName(searchArtist),
  };
}

module.exports = {
  cleanArtistName,
  cleanTrackMetadata,
  getBaseTitle,
  getVariantKinds,
  isUnrequestedAlternateVersion,
  normalizeComparableText,
  queryRequestsVariant,
  stripPresentationNoise,
  stripVariantDecorators,
};
