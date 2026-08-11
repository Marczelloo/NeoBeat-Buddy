const Log = require("../logs/log");

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
  return `${String(artist).trim().toLowerCase()}|${String(title).trim().toLowerCase()}`;
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
    releaseYear: payload.release_date ? Number.parseInt(String(payload.release_date).slice(0, 4), 10) || null : null,
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
  const match = results.find((track) => String(track?.artist?.name || "").toLowerCase() === artist.toLowerCase()) || results[0];
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
  candidate.releaseYear ||= metadata.releaseYear;
  candidate.catalogRank ||= metadata.catalogRank;
  candidate.metadataProvider ||= metadata.metadataProvider;
  candidate.metadataConfidence = Math.max(candidate.metadataConfidence || 0, metadata.metadataConfidence || 0);
  candidate.features = { ...(metadata.features || {}), ...(candidate.features || {}) };
  return candidate;
}

async function enrichCandidateWithDeezerMetadata(candidate) {
  if (!candidate) return candidate;
  const existingCoverage = getFeatureCoverage(candidate.features);
  if (existingCoverage >= 3) {
    candidate.metadataChecked = true;
    candidate.metadataConfidence = Math.max(candidate.metadataConfidence || 0, 1);
    return candidate;
  }

  const metadata = await getDeezerMetadata(candidate);
  return mergeAudioMetadata(candidate, metadata);
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
  enrichCandidatesWithDeezerMetadata,
  getDeezerMetadata,
  getFeatureCoverage,
  getTempoDistance,
  getTempoVariants,
  mergeAudioMetadata,
  normalizeDeezerMetadata,
};
