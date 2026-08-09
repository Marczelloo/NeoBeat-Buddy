const POLISH_DIACRITIC_PATTERN = /[ąćęłńóśźż]/iu;
const VOWEL_PATTERN = /[aeiouyąęó]/iu;
const CONSONANT_PATTERN = /[bcćdfghjklłmnńprsśtwyzźż]/iu;

const MAX_VARIANTS = 3;

function findWordBounds(value, index) {
  let start = index;
  let end = index;
  while (start > 0 && /\p{L}/u.test(value[start - 1])) start -= 1;
  while (end < value.length - 1 && /\p{L}/u.test(value[end + 1])) end += 1;
  return { start, end };
}

function getReplacement(value, index) {
  const source = value[index];
  const lower = source.toLowerCase();
  if (!/^[a-z]$/i.test(source)) return null;

  const { start, end } = findWordBounds(value, index);
  const previous = value[index - 1]?.toLowerCase() || "";
  const next = value[index + 1]?.toLowerCase() || "";
  const isWordEnd = index === end;
  const isWordStart = index === start;
  const upper = source === source.toUpperCase();
  const accented = (lowercase, uppercase) => (upper ? uppercase : lowercase);

  switch (lower) {
    case "l":
      return { value: accented("ł", "Ł"), weight: 0.95 };
    case "o":
      return { value: accented("ó", "Ó"), weight: 0.72 };
    case "e":
      return isWordEnd && CONSONANT_PATTERN.test(previous) ? { value: accented("ę", "Ę"), weight: 0.84 } : null;
    case "a":
      return isWordEnd || CONSONANT_PATTERN.test(next) ? { value: accented("ą", "Ą"), weight: 0.58 } : null;
    case "c":
      return isWordEnd || (VOWEL_PATTERN.test(next) && next !== "i") ? { value: accented("ć", "Ć"), weight: 0.45 } : null;
    case "n":
      return VOWEL_PATTERN.test(next) ? { value: accented("ń", "Ń"), weight: 0.35 } : null;
    case "s":
      return VOWEL_PATTERN.test(next) ? { value: accented("ś", "Ś"), weight: 0.3 } : null;
    case "z":
      if (!isWordStart && !VOWEL_PATTERN.test(next)) return null;
      return { value: accented("ż", "Ż"), weight: 0.4 };
    default:
      return null;
  }
}

/**
 * Builds a tiny list of likely Polish-spelling alternatives for provider
 * search. The original query is always used first and result ranking still
 * evaluates against it. One altered word per variant keeps catalog recall
 * high without turning an autocomplete request into a noisy dictionary scan.
 */
function buildSearchQueryVariants(query, { limit = MAX_VARIANTS } = {}) {
  const text = String(query || "").normalize("NFKC").trim();
  if (!text || !/[a-z]/i.test(text) || POLISH_DIACRITIC_PATTERN.test(text) || limit <= 0) return [];

  const candidates = [];
  for (let index = 0; index < text.length; index += 1) {
    const replacement = getReplacement(text, index);
    if (!replacement) continue;
    const { start, end } = findWordBounds(text, index);
    candidates.push({
      text: `${text.slice(0, index)}${replacement.value}${text.slice(index + 1)}`,
      wordStart: start,
      wordEnd: end,
      changes: [{ index, ...replacement }],
      weight: replacement.weight,
    });
  }

  // Short words such as "zolc" are often typed without every diacritic.
  // Include one fully transformed word when it has multiple strong signals.
  for (const candidate of [...candidates]) {
    const wordCandidates = candidates.filter(
      (other) => other.wordStart === candidate.wordStart && other.wordEnd === candidate.wordEnd
    );
    if (wordCandidates.length < 2 || candidate.wordEnd - candidate.wordStart + 1 > 5) continue;

    const letters = text.split("");
    for (const change of wordCandidates) letters[change.changes[0].index] = change.changes[0].value;
    candidates.push({
      text: letters.join(""),
      wordStart: candidate.wordStart,
      wordEnd: candidate.wordEnd,
      changes: wordCandidates.flatMap((other) => other.changes),
      weight: wordCandidates.reduce((sum, other) => sum + other.weight, 0),
    });
  }

  const byText = new Map();
  for (const candidate of candidates) {
    const current = byText.get(candidate.text);
    if (!current || candidate.weight > current.weight) byText.set(candidate.text, candidate);
  }

  return [...byText.values()]
    .sort((left, right) => right.weight - left.weight || left.changes.length - right.changes.length || left.text.localeCompare(right.text, "pl"))
    .slice(0, limit)
    .map((candidate) => candidate.text);
}

function buildSearchQueries(query, options) {
  const text = String(query || "").trim();
  return text ? [text, ...buildSearchQueryVariants(text, options)] : [];
}

module.exports = {
  MAX_VARIANTS,
  buildSearchQueries,
  buildSearchQueryVariants,
};
