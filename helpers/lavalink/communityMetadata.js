const Log = require("../logs/log");
const { normalizeGenreTags } = require("./genreUtils");
const { getLastFmTagProfile } = require("./lastfmClient");
const { getBaseTitle, normalizeComparableText } = require("./trackNormalization");

const COMMUNITY_CACHE_TTL_MS = Math.max(Number(process.env.AUTOPLAY_COMMUNITY_METADATA_CACHE_TTL_MS) || 30 * 24 * 60 * 60 * 1000, 60 * 60 * 1000);
const COMMUNITY_TIMEOUT_MS = Math.max(Number(process.env.AUTOPLAY_COMMUNITY_METADATA_TIMEOUT_MS) || 4000, 500);
const MUSICBRAINZ_MIN_INTERVAL_MS = Math.max(Number(process.env.AUTOPLAY_MUSICBRAINZ_MIN_INTERVAL_MS) || 1100, 1000);
const COMMUNITY_MIN_TAGS = Math.max(Number(process.env.AUTOPLAY_COMMUNITY_METADATA_MIN_TAGS) || 2, 1);
const cache = new Map();
let musicBrainzNextRequestAt = 0;
let musicBrainzQueue = Promise.resolve();

function isEnabled(name, defaultValue = true) {
  const value = process.env[name];
  return value === undefined ? defaultValue : value !== "false";
}

function getIdentity(candidate = {}) {
  const artist = candidate.artist || candidate.track?.info?.author || "";
  const title = candidate.title || candidate.track?.info?.title || "";
  return `${normalizeComparableText(artist)}|${getBaseTitle(title)}`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMMUNITY_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function comparableMatch(expected, actual) {
  const left = normalizeComparableText(expected);
  const right = normalizeComparableText(actual);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function findExactRecording(recordings, candidate) {
  const expectedTitle = getBaseTitle(candidate?.title || "");
  const expectedArtist = candidate?.artist || "";
  return (recordings || [])
    .filter((recording) => comparableMatch(expectedTitle, getBaseTitle(recording?.title || "")))
    .map((recording) => ({
      recording,
      artist: (recording?.["artist-credit"] || []).map((credit) => credit?.name || credit?.artist?.name).filter(Boolean).join(" "),
    }))
    .find(({ artist }) => comparableMatch(expectedArtist, artist))?.recording || null;
}

function normalizeMusicBrainzMetadata(recording) {
  if (!recording) return null;
  const tags = [
    ...(recording.genres || []).map((genre) => genre?.name),
    ...(recording.tags || []).filter((tag) => Number(tag?.count || 0) > 0).map((tag) => tag?.name),
  ].filter(Boolean);
  const releaseDate = recording?.releases?.map((release) => release?.date).find(Boolean) || "";
  return {
    genres: normalizeGenreTags(tags),
    releaseYear: Number.parseInt(String(releaseDate).slice(0, 4), 10) || null,
    isrc: recording.isrcs?.[0] || null,
    source: "musicbrainz",
    confidence: tags.length ? 0.72 : 0.55,
  };
}

async function fetchMusicBrainzMetadata(candidate) {
  if (!isEnabled("AUTOPLAY_MUSICBRAINZ")) return null;
  const artist = String(candidate?.artist || "").trim();
  const title = String(candidate?.title || "").trim();
  if (!artist || !title) return null;

  const job = musicBrainzQueue.catch(() => {}).then(async () => {
    const wait = Math.max(0, musicBrainzNextRequestAt - Date.now());
    if (wait) await sleep(wait);
    musicBrainzNextRequestAt = Date.now() + MUSICBRAINZ_MIN_INTERVAL_MS;

    const params = new URLSearchParams({ fmt: "json", limit: "5", query: `recording:"${title}" AND artist:"${artist}"` });
    const headers = { "User-Agent": "MewBit/1.1.4 (https://github.com/Marczelloo/NeoBeat-Buddy)" };
    const search = await fetchJson(`https://musicbrainz.org/ws/2/recording?${params}`, headers);
    const match = findExactRecording(search?.recordings, candidate);
    if (!match?.id) return null;

    const details = await fetchJson(
      `https://musicbrainz.org/ws/2/recording/${encodeURIComponent(match.id)}?fmt=json&inc=genres%2Btags%2Breleases%2Bartist-credits%2Bisrcs`,
      headers
    );
    return normalizeMusicBrainzMetadata(details || match);
  });
  musicBrainzQueue = job.catch(() => {});
  return job;
}

function splitAudioDbTags(value) {
  return String(value || "")
    .split(/[;,/|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeAudioDbMetadata(track) {
  if (!track) return null;
  const tags = splitAudioDbTags(track.strGenre).concat(splitAudioDbTags(track.strStyle));
  const moodTags = splitAudioDbTags(track.strMood);
  return {
    genres: normalizeGenreTags(tags),
    moodTags: normalizeGenreTags(moodTags),
    releaseYear: Number.parseInt(String(track.intYearReleased || "").slice(0, 4), 10) || null,
    source: "theaudiodb",
    confidence: tags.length || moodTags.length ? 0.48 : 0.28,
  };
}

async function fetchAudioDbMetadata(candidate) {
  if (!isEnabled("AUTOPLAY_THEAUDIODB")) return null;
  const artist = String(candidate?.artist || "").trim();
  const title = String(candidate?.title || "").trim();
  if (!artist || !title) return null;

  const apiKey = process.env.THEAUDIODB_API_KEY || "2";
  const params = new URLSearchParams({ s: artist, t: title });
  const payload = await fetchJson(`https://www.theaudiodb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchtrack.php?${params}`);
  const match = (payload?.track || []).find((track) =>
    comparableMatch(title, getBaseTitle(track?.strTrack || "")) && comparableMatch(artist, track?.strArtist || "")
  );
  return normalizeAudioDbMetadata(match);
}

function mergeMetadata(...items) {
  const usable = items.filter(Boolean);
  if (!usable.length) return null;
  const genres = normalizeGenreTags(usable.flatMap((item) => item.genres || []));
  const moodTags = normalizeGenreTags(usable.flatMap((item) => item.moodTags || []));
  const sources = usable.map((item) => item.source).filter(Boolean);
  return {
    genres,
    moodTags,
    releaseYear: usable.map((item) => item.releaseYear).find(Boolean) || null,
    isrc: usable.map((item) => item.isrc).find(Boolean) || null,
    metadataSources: [...new Set(sources)],
    metadataConfidence: Math.max(...usable.map((item) => Number(item.confidence) || 0)),
  };
}

/**
 * A bounded metadata aggregator. It runs in a single place, returns a stable
 * schema, and uses a long cache so community APIs are never part of the hot
 * per-candidate scoring loop.
 */
async function getCommunityMetadata(candidate) {
  if (!isEnabled("AUTOPLAY_COMMUNITY_METADATA")) return null;
  const key = getIdentity(candidate);
  if (!key || key === "|") return null;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < COMMUNITY_CACHE_TTL_MS) return cached.metadata;

  try {
    const profile = await getLastFmTagProfile({ artist: candidate.artist, title: candidate.title, album: candidate.album, limit: 8 });
    const lastFm = profile.tags.length ? { genres: profile.tags, source: profile.source, confidence: profile.confidence } : null;
    const musicBrainz = profile.tags.length >= COMMUNITY_MIN_TAGS ? null : await fetchMusicBrainzMetadata(candidate);
    const currentTagCount = normalizeGenreTags([...(lastFm?.genres || []), ...(musicBrainz?.genres || [])]).length;
    const audioDb = currentTagCount >= COMMUNITY_MIN_TAGS ? null : await fetchAudioDbMetadata(candidate);
    const metadata = mergeMetadata(lastFm, musicBrainz, audioDb);
    cache.set(key, { timestamp: Date.now(), metadata });
    return metadata;
  } catch (error) {
    cache.set(key, { timestamp: Date.now(), metadata: null });
    Log.debug("Community autoplay metadata lookup failed", error.name === "AbortError" ? "timeout" : error.message);
    return null;
  }
}

function clearCommunityMetadataCache() {
  cache.clear();
  musicBrainzNextRequestAt = 0;
  musicBrainzQueue = Promise.resolve();
}

module.exports = {
  clearCommunityMetadataCache,
  fetchAudioDbMetadata,
  fetchMusicBrainzMetadata,
  findExactRecording,
  getCommunityMetadata,
  normalizeAudioDbMetadata,
  normalizeMusicBrainzMetadata,
};
