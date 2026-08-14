const SOURCE_LABELS = Object.freeze({
  deezer: "Deezer",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  youtube: "YouTube",
});
const { getArtworkUrls, getTrackArtworkSource } = require("../artwork");
const { getDisplayTrackMetadata } = require("../lavalink/displayMetadata");

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
  const display = getDisplayTrackMetadata(track);
  const source = normalizeSource(info.sourceName || info.source || info.uri);
  const artwork = getArtworkUrls(getTrackArtworkSource(track));

  return {
    id: getTrackId(track),
    index,
    title: display.title,
    author: display.author,
    durationMs: Number(info.length) || 0,
    artworkUrl: artwork.primary,
    artworkFallbackUrl: artwork.fallback,
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

function serializePlaylistTrack(track, index = null) {
  const serialized = serializeTrack({
    info: {
      identifier: track.identifier,
      title: track.title,
      author: track.author,
      length: track.length,
      sourceName: track.source,
      uri: track.uri,
      artworkUrl: track.artworkUrl || track.thumbnail || track.image,
    },
  }, index);

  return { ...serialized, addedAt: Number(track.addedAt) || 0 };
}

function serializePlaylist(playlist, { includeTracks = false } = {}) {
  const serialized = {
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

  if (includeTracks) serialized.tracks = (playlist.tracks || []).map(serializePlaylistTrack);
  return serialized;
}

function serializePlaylistDetails(playlist) {
  return serializePlaylist(playlist, { includeTracks: true });
}

module.exports = {
  SOURCE_LABELS,
  normalizeSource,
  serializeFilters,
  serializeLyrics,
  serializePlaylist,
  serializePlaylistDetails,
  serializePlaylistTrack,
  serializeTrack,
};
