const { getCanonicalTitle, normalizeText } = require("./searchRanking");

function normalizeArtist(value) {
  return normalizeText(value)
    .replace(/\b(?:official|vevo|topic|records?)\b/g, " ")
    .replace(/\b(?:feat|ft|featuring)\b.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTrackIdentity(trackLike) {
  const info = trackLike?.info || {};
  const title = trackLike?.title || info.title || "";
  const artist = trackLike?.artist || info.author || "";
  const identifier = trackLike?.identifier || info.identifier || "";
  const canonicalTitle = getCanonicalTitle(title)
    .replace(/\b(?:official|video|audio|lyrics?|music|mv|visualizer|hd|hq|4k|8k)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedArtist = normalizeArtist(artist);

  return {
    identifier: String(identifier || "").trim(),
    title: canonicalTitle,
    artist: normalizedArtist,
    textKey: canonicalTitle && normalizedArtist ? `text:${normalizedArtist}|${canonicalTitle}` : null,
  };
}

function getTrackIdentityKeys(trackLike, { includeIdentifier = true } = {}) {
  const identity = getTrackIdentity(trackLike);
  const keys = [];

  if (includeIdentifier && identity.identifier) keys.push(`id:${identity.identifier}`);
  if (identity.textKey) keys.push(identity.textKey);

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
  normalizeArtist,
};
