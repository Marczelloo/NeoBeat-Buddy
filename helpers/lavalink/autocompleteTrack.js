const { SEARCH_SOURCE_PREFIXES } = require("./searchSources");

const MAX_AUTOCOMPLETE_VALUE_LENGTH = 100;

function normalizeSourceName(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "soundcloud") return "soundcloud";
  if (source === "spotify") return "spotify";
  if (source === "youtube" || source === "youtube music") return "youtube";
  if (source === "deezer") return "deezer";
  return "";
}

function getTrackSourceName(track) {
  return normalizeSourceName(track?.info?.sourceName || track?.info?.source);
}

function getDirectTrackUri(track) {
  const uri = String(track?.info?.uri || "").trim();
  if (!/^https?:\/\//i.test(uri)) return null;
  return uri.length <= MAX_AUTOCOMPLETE_VALUE_LENGTH ? uri : null;
}

/**
 * Discord sends only the selected option value back to /play. Keep a direct
 * provider URL whenever possible so selecting an autocomplete result cannot
 * trigger a fresh search for the same title on a different provider.
 */
function buildTrackAutocompleteValue(track) {
  const directUri = getDirectTrackUri(track);
  if (directUri) return directUri;

  const author = String(track?.info?.author || "").trim();
  const title = String(track?.info?.title || "").trim();
  const searchQuery = [author, title].filter(Boolean).join(" ");
  const source = getTrackSourceName(track);
  const prefix = SEARCH_SOURCE_PREFIXES[source];
  const sourceQuery = prefix && searchQuery ? `${prefix}:${searchQuery}` : searchQuery;

  return sourceQuery.slice(0, MAX_AUTOCOMPLETE_VALUE_LENGTH);
}

module.exports = {
  MAX_AUTOCOMPLETE_VALUE_LENGTH,
  buildTrackAutocompleteValue,
  getDirectTrackUri,
  getTrackSourceName,
};
