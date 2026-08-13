const Log = require("../logs/log");
const { getCommunityMetadata } = require("./communityMetadata");
const { normalizeGenreTags } = require("./genreUtils");
const { normalizeReleaseYear } = require("./metadataValidation");
const { getBaseTitle, normalizeComparableText } = require("./trackNormalization");

const metadataCache = new Map();
const METADATA_CACHE_TTL_MS = Math.max(
  Number(process.env.AUTOPLAY_DEEZER_METADATA_CACHE_TTL_MS) || 7 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000
);
const REQUEST_TIMEOUT_MS = Math.max(Number(process.env.AUTOPLAY_METADATA_TIMEOUT_MS) || 3500, 500);

function isFinitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function getTrackIdentity(candidate) {
  const artist = candidate?.artist || candidate?.track?.info?.author || "";
  const title = candidate?.title || candidate?.track?.info?.title || "";
  return `${normalizeComparableText(artist)}|${getBaseTitle(title)}`;
}

function getDeezerTrackId(candidate) {
  const identifier = candidate?.deezerId || candidate?.track?.info?.identifier || candidate?.identifier;
  const sourceName = String(candidate?.track?.info?.sourceName || candidate?.track?.info?.source || "").toLowerCase();
  const uri = String(candidate?.track?.info?.uri || candidate?.uri || "");

  if ((sourceName === "deezer" || String(candidate?.source || "").startsWith("deezer")) && /^\d+$/.test(String(identifier))) {
    return String(identifier);
  }

  const uriMatch = uri.match(/deezer\.com\/(?:[a-z]{2}\/)?track\/(\d+)/i);
  return uriMatch?.[1] || null;
}

function getFeatureCoverage(features) {
  if (!features || typeof features !== "object") return 0;
  return ["tempo", "energy", "valence", "danceability", "acousticness", "instrumentalness"].filter((name) =>
    Number.isFinite(Number(features[name]))
  ).length;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function getMetadataMoodCues(candidate) {
  return [candidate?.artist, candidate?.title, ...(candidate?.genres || []), ...(candidate?.moodTags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Builds low-confidence feature hints from catalog metadata that is available
 * without Spotify audio-features access. These are deliberately kept separate
 * from measured features: BPM/gain can suggest energy, but they cannot prove
 * a song's actual mood. The scorer may use these hints only as a tie-breaker.
 */
function deriveCatalogFeatureHints(candidate) {
  const measured = candidate?.features || {};
  const tempo = Number(measured.tempo);
  const loudness = Number(measured.loudness);
  const cues = getMetadataMoodCues(candidate);
  const hasTempo = isFinitePositive(tempo);
  const hasLoudness = Number.isFinite(loudness);
  if (!hasTempo && !hasLoudness) return null;

  const hints = {};
  if (hasTempo || hasLoudness) {
    const tempoEnergy = hasTempo ? clamp01((tempo - 72) / 105) : 0.5;
    const loudnessEnergy = hasLoudness ? clamp01((loudness + 18) / 16) : 0.5;
    hints.energy = Number((tempoEnergy * 0.58 + loudnessEnergy * 0.42).toFixed(3));
  }

  const positiveCue = /\b(?:dance|disco|funk|party|summer|upbeat|happy|feel[ -]?good|euphoric|joy|bright)\b/.test(cues);
  const subduedCue = /\b(?:ambient|acoustic|sad|melanchol|dark|doom|slowcore|depress|ballad|somber|piano)\b/.test(cues);
  if (positiveCue || subduedCue) {
    hints.valence = Number((0.5 + (positiveCue ? 0.12 : 0) - (subduedCue ? 0.12 : 0)).toFixed(3));
  }

  const danceCue = /\b(?:dance|disco|funk|house|edm|electronic|hip[ -]?hop|rnb|pop|reggaeton)\b/.test(cues);
  if (danceCue && hasTempo) {
    hints.danceability = Number((0.42 + clamp01((tempo - 82) / 95) * 0.28).toFixed(3));
  }

  return Object.keys(hints).length ? hints : null;
}

function normalizeDeezerMetadata(payload) {
  if (!payload || typeof payload !== "object" || payload.error) return null;

  const tempo = isFinitePositive(payload.bpm) ? Number(payload.bpm) : null;
  const gain = Number.isFinite(Number(payload.gain)) ? Number(payload.gain) : null;
  const features = {};
  if (tempo) features.tempo = tempo;
  if (gain !== null) features.loudness = gain;

  return {
    deezerId: payload.id ? String(payload.id) : null,
    isrc: payload.isrc || null,
    releaseYear: normalizeReleaseYear(payload.release_date),
    catalogRank: Number.isFinite(Number(payload.rank)) ? Number(payload.rank) : null,
    features: Object.keys(features).length ? features : null,
    metadataConfidence: tempo ? 0.45 : gain !== null ? 0.2 : 0.05,
    metadataProvider: "deezer",
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDeezerMetadata(candidate) {
  const trackId = getDeezerTrackId(candidate);
  if (trackId) {
    const payload = await fetchJson(`https://api.deezer.com/track/${encodeURIComponent(trackId)}`);
    const metadata = normalizeDeezerMetadata(payload);
    if (metadata) return metadata;
  }

  const artist = String(candidate?.artist || "").trim();
  const title = String(candidate?.title || "").trim();
  if (!artist || !title) return null;

  const query = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
  const payload = await fetchJson(`https://api.deezer.com/search/track?q=${query}&limit=5`);
  const results = Array.isArray(payload?.data) ? payload.data : [];
  const normalizedArtist = normalizeComparableText(artist);
  const normalizedTitle = getBaseTitle(title);
  const match = results.find((track) => {
    const resultArtist = normalizeComparableText(track?.artist?.name || "");
    const resultTitle = getBaseTitle(track?.title || "");
    return resultArtist === normalizedArtist && resultTitle === normalizedTitle;
  });
  if (!match?.id) return null;

  const details = await fetchJson(`https://api.deezer.com/track/${encodeURIComponent(match.id)}`);
  return normalizeDeezerMetadata(details || match);
}

async function getDeezerMetadata(candidate) {
  const key = getTrackIdentity(candidate);
  if (!key || key === "|") return null;

  const cached = metadataCache.get(key);
  if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL_MS) return cached.metadata;

  try {
    const metadata = await fetchDeezerMetadata(candidate);
    metadataCache.set(key, { timestamp: Date.now(), metadata });
    return metadata;
  } catch (error) {
    metadataCache.set(key, { timestamp: Date.now(), metadata: null });
    Log.debug("Deezer autoplay metadata lookup failed", error.name === "AbortError" ? "timeout" : error.message);
    return null;
  }
}

function mergeAudioMetadata(candidate, metadata, { checked = true } = {}) {
  if (!candidate) return candidate;
  candidate.metadataChecked = checked;
  if (!metadata) {
    candidate.metadataConfidence = candidate.metadataConfidence || 0;
    return candidate;
  }

  candidate.deezerId ||= metadata.deezerId;
  candidate.isrc ||= metadata.isrc;
  candidate.releaseYear = normalizeReleaseYear(candidate.releaseYear) || normalizeReleaseYear(metadata.releaseYear);
  candidate.catalogRank ||= metadata.catalogRank;
  candidate.metadataProvider ||= metadata.metadataProvider;
  candidate.metadataConfidence = Math.max(candidate.metadataConfidence || 0, metadata.metadataConfidence || 0);
  candidate.features = { ...(metadata.features || {}), ...(candidate.features || {}) };
  return candidate;
}

function mergeCommunityMetadata(candidate, metadata) {
  if (!candidate) return candidate;
  candidate.communityMetadataChecked = true;
  if (!metadata) return candidate;

  candidate.genres = normalizeGenreTags([...(candidate.genres || []), ...(metadata.genres || [])], {
    artist: candidate.artist,
    title: candidate.title,
  });
  candidate.moodTags = normalizeGenreTags([...(candidate.moodTags || []), ...(metadata.moodTags || [])], {
    artist: candidate.artist,
    title: candidate.title,
  });
  candidate.metadataSources = [...new Set([...(candidate.metadataSources || []), ...(metadata.metadataSources || [])])];
  candidate.metadataProvider ||= candidate.metadataSources.join("+") || null;
  candidate.metadataConfidence = Math.max(candidate.metadataConfidence || 0, metadata.metadataConfidence || 0);
  candidate.releaseYear = normalizeReleaseYear(candidate.releaseYear) || normalizeReleaseYear(metadata.releaseYear);
  candidate.isrc ||= metadata.isrc;
  return candidate;
}

async function enrichCandidateWithDeezerMetadata(candidate) {
  if (!candidate) return candidate;
  const existingCoverage = getFeatureCoverage(candidate.features);
  if (existingCoverage >= 3) {
    candidate.metadataChecked = true;
    candidate.metadataConfidence = Math.max(candidate.metadataConfidence || 0, 1);
    candidate.derivedFeatures ||= deriveCatalogFeatureHints(candidate);
    return candidate;
  }

  const metadata = await getDeezerMetadata(candidate);
  mergeAudioMetadata(candidate, metadata);
  candidate.derivedFeatures = deriveCatalogFeatureHints(candidate);
  return candidate;
}

async function enrichCandidateWithAutoplayMetadata(candidate, { community = true } = {}) {
  if (!candidate) return candidate;
  await enrichCandidateWithDeezerMetadata(candidate);
  if (community) mergeCommunityMetadata(candidate, await getCommunityMetadata(candidate));
  candidate.derivedFeatures = deriveCatalogFeatureHints(candidate);
  return candidate;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = Array(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function enrichCandidatesWithDeezerMetadata(candidates, limit = 18) {
  const targets = candidates
    .filter((candidate) => getFeatureCoverage(candidate.features) < 3)
    .slice(0, Math.max(Number(limit) || 0, 0));

  await mapWithConcurrency(targets, 3, (candidate) => enrichCandidateWithDeezerMetadata(candidate));
  return candidates;
}

function getTempoVariants(value) {
  const tempo = Number(value);
  if (!isFinitePositive(tempo)) return [];
  return [tempo];
}

function getTempoDistance(left, right) {
  const leftTempo = Number(left);
  const rightTempo = Number(right);
  if (!isFinitePositive(leftTempo) || !isFinitePositive(rightTempo)) return null;

  const directDistance = Math.abs(leftTempo - rightTempo);
  const ratio = Math.max(leftTempo, rightTempo) / Math.min(leftTempo, rightTempo);

  // Only normalize an unmistakable double-time reading. Comparing every
  // half-time variant against every other half-time variant makes 108 and 112
  // look falsely closer than they are, while 163 and 108 should remain a
  // visibly different transition.
  if (ratio >= 1.75) {
    const normalizedHigh = Math.max(leftTempo, rightTempo) / 2;
    return Math.min(directDistance, Math.abs(normalizedHigh - Math.min(leftTempo, rightTempo)));
  }

  return directDistance;
}

function clearAutoplayMetadataCache() {
  metadataCache.clear();
}

module.exports = {
  clearAutoplayMetadataCache,
  enrichCandidateWithDeezerMetadata,
  enrichCandidateWithAutoplayMetadata,
  enrichCandidatesWithDeezerMetadata,
  getDeezerMetadata,
  deriveCatalogFeatureHints,
  getFeatureCoverage,
  getTempoDistance,
  getTempoVariants,
  mergeAudioMetadata,
  mergeCommunityMetadata,
  normalizeDeezerMetadata,
};
