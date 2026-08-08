const SOURCE_LABELS = Object.freeze({
  deezer: "Deezer",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  youtube: "YouTube",
});

function normalizeSource(source) {
  const value = String(source || "unknown").toLowerCase();
  if (value.includes("soundcloud") || value === "scsearch") return "soundcloud";
  if (value.includes("spotify") || value === "spsearch") return "spotify";
  if (value.includes("deezer") || value === "dzsearch") return "deezer";
  if (value.includes("youtube") || value === "ytsearch" || value === "ytmsearch") return "youtube";
  return value;
}

function getTrackId(track) {
  const info = track?.info || {};
  return String(info.identifier || info.uri || `${info.title || "track"}:${info.author || "artist"}`);
}

function serializeTrack(track, index = null) {
  if (!track) return null;

  const info = track.info || {};
  const source = normalizeSource(info.sourceName || info.source || info.uri);

  return {
    id: getTrackId(track),
    index,
    title: String(info.title || "Unknown track"),
    author: String(info.author || "Unknown artist"),
    durationMs: Number(info.length) || 0,
    artworkUrl: info.artworkUrl || info.thumbnail || null,
    uri: info.uri || null,
    source,
    sourceLabel: SOURCE_LABELS[source] || source,
    isStream: Boolean(info.isStream),
    requester: info.requesterTag || info.requester || null,
    autoplay: Boolean(track.userData?.autoplay || info.autoplayed),
  };
}

function serializeLyrics(payload) {
  if (!payload) return null;

  const lines = Array.isArray(payload.lines)
    ? payload.lines
        .map((line) => ({
          timestamp: Number(line.timestamp) || 0,
          line: String(line.line || "").trim(),
        }))
        .filter((line) => line.line)
    : [];

  return {
    provider: payload.source || payload.provider || "unknown",
    synced: Boolean(payload.synced || lines.length),
    text: String(payload.lyrics || payload.text || ""),
    lines,
  };
}

function serializeFilters(filters = {}) {
  const equalizer = Array.isArray(filters.equalizer)
    ? filters.equalizer.map((band) => ({ band: Number(band.band), gain: Number(band.gain) }))
    : [];

  return {
    preset: filters.preset || "flat",
    effectPreset: filters.filterPreset || "off",
    equalizer,
  };
}

function serializePlaylist(playlist) {
  return {
    id: playlist.id,
    name: playlist.name,
    type: playlist.type,
    description: playlist.description || "",
    trackCount: Array.isArray(playlist.tracks) ? playlist.tracks.length : 0,
    thumbnail: playlist.thumbnail || null,
    public: Boolean(playlist.public),
    collaborative: Boolean(playlist.collaborative),
    isDefault: Boolean(playlist.isDefault),
  };
}

module.exports = {
  SOURCE_LABELS,
  normalizeSource,
  serializeFilters,
  serializeLyrics,
  serializePlaylist,
  serializeTrack,
};
