const SEARCH_SOURCE_PREFIXES = Object.freeze({
  deezer: "dzsearch",
  youtube: "ytsearch",
  spotify: "spsearch",
  soundcloud: "scsearch",
});

const FALLBACK_SOURCES = Object.freeze({
  auto: ["deezer", "soundcloud", "youtube", "spotify"],
  deezer: ["soundcloud", "youtube", "spotify"],
  youtube: ["soundcloud", "deezer", "spotify"],
  spotify: ["soundcloud", "deezer", "youtube"],
  soundcloud: ["youtube", "deezer", "spotify"],
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

function getFallbackSources(source) {
  return FALLBACK_SOURCES[source] ? [...FALLBACK_SOURCES[source]] : [...FALLBACK_SOURCES.auto];
}

module.exports = {
  SEARCH_SOURCE_PREFIXES,
  FALLBACK_SOURCES,
  getFallbackSource,
  getFallbackSources,
  getSearchPrefix,
  resolveSearchSource,
};
