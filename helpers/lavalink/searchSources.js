const SEARCH_SOURCE_PREFIXES = Object.freeze({
  deezer: "dzsearch",
  youtube: "ytsearch",
  spotify: "spsearch",
});

function resolveSearchSource(selectedSource, userSource, guildSource) {
  if (selectedSource && ["auto", ...Object.keys(SEARCH_SOURCE_PREFIXES)].includes(selectedSource)) {
    return selectedSource;
  }

  if (userSource && ["auto", ...Object.keys(SEARCH_SOURCE_PREFIXES)].includes(userSource)) return userSource;
  if (guildSource && ["auto", ...Object.keys(SEARCH_SOURCE_PREFIXES)].includes(guildSource)) return guildSource;
  return "deezer";
}

function getSearchPrefix(source) {
  return SEARCH_SOURCE_PREFIXES[source] || SEARCH_SOURCE_PREFIXES.deezer;
}

function getFallbackSource(source) {
  return source === "auto" ? "youtube" : source;
}

module.exports = {
  SEARCH_SOURCE_PREFIXES,
  getFallbackSource,
  getSearchPrefix,
  resolveSearchSource,
};
