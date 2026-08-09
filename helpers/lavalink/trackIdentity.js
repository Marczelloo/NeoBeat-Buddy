const { normalizeText } = require("./searchRanking");
const { cleanArtistName, getBaseTitle } = require("./trackNormalization");

function cleanArtist(value) {
  return normalizeText(
    cleanArtistName(value)
      .replace(/\b(?:feat(?:uring)?|ft)\.?\b.*$/i, " ")
  )
    .replace(/\b(?:official(?: artist channel)?|vevo|topic|records?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getArtistKeys(value) {
  const expanded = String(value || "").replace(/([a-z\d])([A-Z])/g, "$1 $2");
  const contributors = expanded.split(/\s*(?:,|&|\+|\/|\bx\b|\bwith\b|\bfeat(?:uring)?\.?\b|\bft\.?\b)\s*/i);
  const contributorKeys = contributors.map(cleanArtist).filter(Boolean);
  const keys = [contributorKeys[0], cleanArtist(expanded), ...contributorKeys.slice(1)].filter(Boolean);

  return [...new Set(keys)];
}

function normalizeArtist(value) {
  return getArtistKeys(value)[0] || "";
}

function normalizeTitle(value, artistKeys) {
  const rawTitle = String(value || "").trim();
  const explicitParts = rawTitle.split(/\s[-–—|]\s/);
  let title = rawTitle;

  if (explicitParts.length > 1) {
    const prefixKeys = getArtistKeys(explicitParts[0]);
    if (prefixKeys.some((key) => artistKeys.includes(key))) {
      title = explicitParts.slice(1).join(" - ");
    }
  }

  let canonicalTitle = getBaseTitle(title);

  // YouTube channels sometimes repeat the artist in the title without a
  // reliable delimiter. Remove that provider-specific prefix/suffix only
  // when a real song title remains.
  for (const artistKey of [...artistKeys].sort((a, b) => b.length - a.length)) {
    if (canonicalTitle.startsWith(`${artistKey} `)) canonicalTitle = canonicalTitle.slice(artistKey.length).trim();
    if (canonicalTitle.endsWith(` ${artistKey}`)) canonicalTitle = canonicalTitle.slice(0, -artistKey.length).trim();
  }

  return canonicalTitle;
}

function getTrackIdentity(trackLike) {
  const info = trackLike?.info || {};
  const canonical = trackLike?.userData?.autoplayReference || {};
  const title = canonical.title || trackLike?.title || info.title || "";
  const artist = canonical.artist || trackLike?.artist || info.author || "";
  const identifier = trackLike?.identifier || info.identifier || "";
  const artistKeys = getArtistKeys(artist);
  const canonicalTitle = normalizeTitle(title, artistKeys);
  const normalizedArtist = artistKeys[0] || "";
  const textKeys = artistKeys.map((artistKey) => `text:${artistKey}|${canonicalTitle}`);

  return {
    identifier: String(identifier || "").trim(),
    title: canonicalTitle,
    artist: normalizedArtist,
    artistKeys,
    textKey: canonicalTitle && normalizedArtist ? `text:${normalizedArtist}|${canonicalTitle}` : null,
    textKeys: canonicalTitle ? textKeys : [],
  };
}

function getTrackIdentityKeys(trackLike, { includeIdentifier = true } = {}) {
  const identity = getTrackIdentity(trackLike);
  const keys = [];

  if (includeIdentifier && identity.identifier) keys.push(`id:${identity.identifier}`);
  keys.push(...identity.textKeys);

  return keys;
}

function hasTrackIdentity(history, trackLike, { includeIdentifier = true } = {}) {
  const candidateKeys = new Set(getTrackIdentityKeys(trackLike, { includeIdentifier }));
  if (candidateKeys.size === 0) return false;

  return (Array.isArray(history) ? history : []).some((track) =>
    getTrackIdentityKeys(track, { includeIdentifier }).some((key) => candidateKeys.has(key))
  );
}

module.exports = {
  getTrackIdentity,
  getTrackIdentityKeys,
  hasTrackIdentity,
  getArtistKeys,
  normalizeArtist,
  normalizeTitle,
};
