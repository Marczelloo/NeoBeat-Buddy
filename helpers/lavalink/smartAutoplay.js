const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { getAutoplayExposureSnapshot, getExposureKey, getExposureRecord } = require("./autoplayExposure");
const {
  enrichCandidateWithAutoplayMetadata,
  enrichCandidatesWithDeezerMetadata,
  getFeatureCoverage,
  getTempoDistance,
} = require("./autoplayMetadata");
const { scoreCandidates, getTimeOfDayFactor, hasReliableSessionVibe } = require("./candidateScoring");
const { areGenreFamiliesCompatible, getGenreFamilies, normalizeGenreTags } = require("./genreUtils");
const { getLastFmSimilarTracks, getLastFmTagProfile } = require("./lastfmClient");
const { normalizeReleaseYear } = require("./metadataValidation");
const { getPoru } = require("./players");
const { filterPlayableSearchResults, rankSearchResults } = require("./searchRanking");
const { buildSessionProfile, genreCache, getTrackMetadata, isAutoplayTrack } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const {
  getSpotifyBasedSuggestions,
  enrichCandidatesWithSpotifyMetadata,
} = require("./spotifyRecommendations");
const {
  cleanTrackMetadata,
  getAutoplayVersionCompatibility,
  getBaseTitle,
  getVariantKinds,
  normalizeComparableText,
} = require("./trackNormalization");
const { filterValidSongs } = require("./trackValidation");

const USE_SPOTIFY_AUTOPLAY = process.env.USE_SPOTIFY_AUTOPLAY === "true";
const USE_SPOTIFY_METADATA = process.env.USE_SPOTIFY_METADATA === "true";
const LASTFM_AUTOPLAY_FETCH_LIMIT = Number(process.env.LASTFM_AUTOPLAY_FETCH_LIMIT ?? 18);
const LASTFM_AUTOPLAY_RESOLVE_LIMIT = Number(process.env.LASTFM_AUTOPLAY_RESOLVE_LIMIT ?? 12);
const AUTOPLAY_DIVERSITY_POOL_SIZE = Number(process.env.AUTOPLAY_DIVERSITY_POOL_SIZE ?? 4);
const AUTOPLAY_DIVERSITY_SCORE_BAND = Number(process.env.AUTOPLAY_DIVERSITY_SCORE_BAND ?? 6);
const AUTOPLAY_SELECTION_MAX_SCORE_DROP = Number(process.env.AUTOPLAY_SELECTION_MAX_SCORE_DROP ?? 4);
const AUTOPLAY_SELECTION_QUALITY_ADVANTAGE = Number(process.env.AUTOPLAY_SELECTION_QUALITY_ADVANTAGE ?? 3);
const AUTOPLAY_MIX_FALLBACK_MIN_SCORE = Number(process.env.AUTOPLAY_MIX_FALLBACK_MIN_SCORE ?? 58);
const AUTOPLAY_TRANSITION_QUALITY_MIN = Number(process.env.AUTOPLAY_TRANSITION_QUALITY_MIN ?? 6);
const AUTOPLAY_TRANSITION_QUALITY_GUARD_AFTER = Math.max(Number(process.env.AUTOPLAY_TRANSITION_QUALITY_GUARD_AFTER ?? 2), 1);
const USE_DEEZER_METADATA = process.env.AUTOPLAY_DEEZER_METADATA !== "false";
const AUTOPLAY_DEEZER_METADATA_LIMIT = Number(process.env.AUTOPLAY_DEEZER_METADATA_LIMIT ?? 18);
const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
const CONTROL_CHARACTER_PATTERN = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  "g"
);

function formatLogValue(value, maxLength = 160) {
  return String(value || "")
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(CONTROL_CHARACTER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function formatCandidateDiagnostic(candidate) {
  if (!candidate) return "none";
  const score = Number.isFinite(Number(candidate.score)) ? Number(candidate.score).toFixed(2) : "?";
  const quality = Number.isFinite(Number(candidate.transitionQuality)) ? Number(candidate.transitionQuality).toFixed(2) : "?";
  const confidence = candidate.vibeConfidence || "unknown";
  const source = candidate.providerSources?.join("+") || candidate.source || "unknown";
  const genres = candidate.genres?.slice(0, 3).join("/") || "none";
  const status = candidate.hardRejected ? `reject:${candidate.rejectionReason || "unknown"}` : candidate.fallbackOnly ? "fallback-only" : candidate.deferred ? `defer:${candidate.deferredReason || "artist"}` : "eligible";
  return `${formatLogValue(candidate.artist, 42)} - ${formatLogValue(candidate.title, 58)} score=${score} quality=${quality} confidence=${confidence} source=${source} genres=${genres} status=${status}`;
}

function getLavalinkNode() {
  return getPoru()?.leastUsedNodes?.[0] || null;
}

function getLavalinkBaseUrl() {
  const node = getLavalinkNode();
  const host = node?.options?.host || process.env.LAVALINK_HOST || "127.0.0.1";
  const port = node?.options?.port || Number(process.env.LAVALINK_PORT || 2333);
  const protocol = node?.options?.secure ? "https" : "http";
  return `${protocol}://${host}:${port}`;
}

async function loadLavalinkTracks(query) {
  const node = getLavalinkNode();
  const response = await fetch(`${getLavalinkBaseUrl()}/v4/loadtracks?identifier=${encodeURIComponent(query)}`, {
    headers: { Authorization: node?.options?.password || process.env.LAVALINK_PASSWORD || "youshallnotpass" },
  });

  if (!response.ok) throw new Error(`Lavalink search failed with status ${response.status}`);

  const data = await response.json();
  if (data?.loadType === "playlist") return data.data?.tracks || [];
  if (data?.loadType === "search" || data?.loadType === "track") return data.data || [];
  return [];
}

function candidateKey(candidate) {
  const canonicalKey = getExposureKey(candidate);
  if (canonicalKey) return `canonical:${canonicalKey}`;

  const identifier = candidate?.identifier || candidate?.track?.info?.identifier;
  return identifier ? `id:${identifier}` : null;
}

function mergeCandidates(candidates) {
  const merged = new Map();

  for (const candidate of candidates) {
    if (!candidate?.title || !candidate?.artist) continue;
    const key = candidateKey(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...candidate,
        genres: normalizeGenreTags(candidate.genres, { artist: candidate.artist, title: candidate.title }),
        providerSources: [candidate.source].filter(Boolean),
      });
      continue;
    }

    existing.genres = normalizeGenreTags([...(existing.genres || []), ...(candidate.genres || [])], {
      artist: existing.artist,
      title: existing.title,
    });
    const mergedFeatures = { ...(candidate.features || {}), ...(existing.features || {}) };
    existing.features = Object.keys(mergedFeatures).length ? mergedFeatures : null;
    existing.metadataChecked ||= candidate.metadataChecked;
    existing.metadataConfidence = Math.max(existing.metadataConfidence || 0, candidate.metadataConfidence || 0);
    existing.metadataProvider ||= candidate.metadataProvider;
    existing.deezerId ||= candidate.deezerId;
    existing.isrc ||= candidate.isrc;
    existing.catalogRank ||= candidate.catalogRank;
    existing.similarity = Math.max(existing.similarity || 0, candidate.similarity || 0);
    existing.popularity = Math.max(existing.popularity || 0, candidate.popularity || 0);
    existing.releaseYear ||= candidate.releaseYear;
    existing.track ||= candidate.track;
    existing.providerSources = [...new Set([...(existing.providerSources || []), candidate.source].filter(Boolean))];
  }

  return [...merged.values()];
}

function normalizeLastFmSimilarity(match, maximumMatch) {
  const value = Number(match);
  const max = Number(maximumMatch);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 1) return Math.min(1, value);
  if (Number.isFinite(max) && max > 1) return Math.min(1, value / max);
  return Math.min(1, value / 100);
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

function getRelevantPlayableTrack(tracks, query) {
  const playable = filterPlayableSearchResults(filterValidSongs(tracks || []), query);
  return rankSearchResults(playable, query)[0] || null;
}

function getTokenCoverage(needle, haystack) {
  const needleTokens = normalizeComparableText(needle).split(" ").filter(Boolean);
  const haystackTokens = new Set(normalizeComparableText(haystack).split(" ").filter(Boolean));
  if (!needleTokens.length) return 0;
  return needleTokens.filter((token) => haystackTokens.has(token)).length / needleTokens.length;
}

const UNEXPECTED_MASHUP_MARKER_PATTERN = /\b(?:mash\s*up|bootleg|blend|megamix|flip|ale\s+to|versus|vs\.?)(?:\b|$)/i;
const PROVIDER_UPLOADER_ALIAS_PATTERN = /\b(?:topic|vevo|official|records?|music|audio|channel|entertainment|lyrics?)\b/i;

function getProviderValidationIssue(candidate, track) {
  const candidateKinds = getVariantKinds(candidate?.title || "");
  const resolvedTitle = track?.info?.title || "";
  const resolvedKinds = getVariantKinds(resolvedTitle);
  const unexpectedKinds = resolvedKinds.filter((kind) => !candidateKinds.includes(kind));
  if (unexpectedKinds.length > 0) return `unexpected-version:${unexpectedKinds.join(",")}`;

  if (
    UNEXPECTED_MASHUP_MARKER_PATTERN.test(resolvedTitle) &&
    !UNEXPECTED_MASHUP_MARKER_PATTERN.test(candidate?.title || "")
  ) {
    return "unexpected-mashup-or-edit";
  }

  const expectedArtist = normalizeComparableText(candidate?.artist || "");
  const resolvedAuthor = normalizeComparableText(track?.info?.author || "");
  const resolvedText = `${resolvedAuthor} ${normalizeComparableText(resolvedTitle)}`.trim();
  const authorCoverage = getTokenCoverage(expectedArtist, resolvedAuthor);
  const combinedCoverage = getTokenCoverage(expectedArtist, resolvedText);
  const isUploaderAlias = PROVIDER_UPLOADER_ALIAS_PATTERN.test(resolvedAuthor);
  if (expectedArtist && authorCoverage < 0.5 && !(isUploaderAlias && combinedCoverage >= 0.5)) {
    return "provider-author-mismatch";
  }

  return null;
}

function matchesAutoplayCandidate(candidate, track) {
  const candidateTitle = getBaseTitle(candidate?.title || "");
  const candidateArtist = normalizeComparableText(candidate?.artist || "");
  const trackTitle = getBaseTitle(track?.info?.title || "");
  const trackArtist = normalizeComparableText(track?.info?.author || "");
  const combinedTrackText = `${trackArtist} ${trackTitle}`.trim();
  const titleCoverage = getTokenCoverage(candidateTitle, trackTitle);
  const artistCoverage = getTokenCoverage(candidateArtist, trackArtist);
  const combinedArtistCoverage = getTokenCoverage(candidateArtist, combinedTrackText);
  const uploaderAlias = PROVIDER_UPLOADER_ALIAS_PATTERN.test(trackArtist);

  return titleCoverage >= 0.75 && (artistCoverage >= 0.5 || (uploaderAlias && combinedArtistCoverage >= 0.5));
}

/**
 * Cleans up title for better search results
 * @param {string} title - Raw track title
 * @param {string} author - Raw track author
 * @returns {Object} Cleaned title and artist
 */
function cleanTrackInfo(title, author) {
  return cleanTrackMetadata(title, author);
}

function getAutoplayReference(track) {
  const canonical = track?.userData?.autoplayReference;
  return cleanTrackInfo(canonical?.title || track?.info?.title, canonical?.artist || track?.info?.author);
}

function applyCandidateMetadata(track, candidate) {
  track.userData = track.userData || {};
  const canonical = cleanTrackInfo(candidate.title, candidate.artist);

  if (canonical.cleanTitle && canonical.searchArtist) {
    track.userData.autoplayReference = {
      title: canonical.cleanTitle,
      artist: canonical.searchArtist,
    };
  }
  const normalizedGenres = normalizeGenreTags(candidate.genres, { artist: candidate.artist, title: candidate.title });
  if (normalizedGenres.length) track.userData.genres = normalizedGenres;
  if (candidate.moodTags?.length) track.userData.moodTags = normalizeGenreTags(candidate.moodTags, { artist: candidate.artist, title: candidate.title });
  if (candidate.features) track.userData.features = candidate.features;
  if (candidate.derivedFeatures) track.userData.derivedFeatures = candidate.derivedFeatures;
  if (candidate.metadataChecked) track.userData.metadataChecked = true;
  if (Number.isFinite(candidate.metadataConfidence)) track.userData.metadataConfidence = candidate.metadataConfidence;
  if (candidate.metadataProvider) track.userData.metadataProvider = candidate.metadataProvider;
  if (candidate.metadataSources?.length) track.userData.metadataSources = candidate.metadataSources;
  if (candidate.isrc) {
    track.userData.isrc = candidate.isrc;
    track.userData.autoplayIsrc = candidate.isrc;
  }
  const releaseYear = normalizeReleaseYear(candidate.releaseYear);
  if (releaseYear) track.userData.releaseYear = releaseYear;

  return track;
}

async function enrichManualAnchorTracks(tracks, guildId) {
  const anchors = (Array.isArray(tracks) ? tracks : []).filter((track) => track && !isAutoplayTrack(track)).slice(0, 4);
  if (!anchors.length) return anchors;

  await mapWithConcurrency(anchors, 2, async (track) => {
    const reference = getAutoplayReference(track);
    if (!reference.cleanTitle || !reference.searchArtist) return;

    const candidate = {
      artist: reference.searchArtist,
      title: reference.cleanTitle,
      genres: track.userData?.genres || [],
      features: track.userData?.features || null,
      derivedFeatures: track.userData?.derivedFeatures || null,
      releaseYear: track.userData?.releaseYear || null,
      moodTags: track.userData?.moodTags || [],
      album: track.info?.albumName || track.info?.album?.name || "",
    };

    if (!candidate.genres.length) {
      const tagProfile = await getLastFmTagProfile({
        artist: reference.searchArtist,
        title: reference.cleanTitle,
        album: candidate.album,
        limit: 8,
      });
      if (tagProfile.tags.length) {
        candidate.genres = tagProfile.tags;
        candidate.metadataConfidence = tagProfile.confidence;
        candidate.metadataProvider = tagProfile.source;
      }
    }
    if (USE_DEEZER_METADATA) await enrichCandidateWithAutoplayMetadata(candidate);

    applyCandidateMetadata(track, candidate);
    track.userData.manual = true;
    track.userData.autoplay = false;

    if (track.info?.identifier && (candidate.genres?.length || candidate.features || candidate.derivedFeatures)) {
      genreCache.set(track.info.identifier, {
        genres: candidate.genres || [],
        features: candidate.features || null,
        derivedFeatures: candidate.derivedFeatures || null,
        metadataConfidence: candidate.metadataConfidence || 0,
        metadataProvider: candidate.metadataProvider || null,
        metadataSources: candidate.metadataSources || [],
        releaseYear: candidate.releaseYear || null,
      });
    }
  });

  Log.debug("Manual autoplay anchors enriched", "", `guild=${guildId}`, `count=${anchors.length}`);
  return anchors;
}

async function resolveCanonicalReference(cleanTitle, searchArtist, guildId) {
  try {
    const query = `${searchArtist} ${cleanTitle}`.trim();
    const tracks = await loadLavalinkTracks(`dzsearch:${query}`);
    const track = getRelevantPlayableTrack(tracks, query);
    if (!track?.info) return null;

    const canonical = cleanTrackInfo(track.info.title, track.info.author);
    if (!canonical.cleanTitle || !canonical.searchArtist) return null;

    Log.debug("Canonical autoplay reference resolved", "", `guild=${guildId}`, `artist=${canonical.searchArtist}`, `title=${canonical.cleanTitle}`);
    return canonical;
  } catch (error) {
    Log.debug("Canonical autoplay reference lookup failed", error.message, `guild=${guildId}`);
    return null;
  }
}

/**
 * Fetches Deezer recommendations via Lavalink
 * @param {string} guildId - Guild identifier
 * @param {string} cleanTitle - Cleaned track title
 * @param {string} searchArtist - Search artist name
 * @returns {Promise<Array>} Array of candidate tracks from Deezer
 */
async function fetchDeezerCandidates(guildId, cleanTitle, searchArtist) {
  const candidates = [];

  try {
    // Search for track on Deezer
    const deezerSearchQuery = `dzsearch:${searchArtist} ${cleanTitle}`;
    Log.info("🎵 Searching Deezer", "", `guild=${guildId}`, `query=${deezerSearchQuery}`);

    const deezerSearchTracks = await loadLavalinkTracks(deezerSearchQuery);

    if (deezerSearchTracks.length > 0) {
      const deezerTrack = getRelevantPlayableTrack(deezerSearchTracks, `${searchArtist} ${cleanTitle}`);
      if (!deezerTrack || !matchesAutoplayCandidate({ artist: searchArtist, title: cleanTitle }, deezerTrack)) {
        Log.debug("Rejected Deezer recommendation seed with mismatched identity", "", `guild=${guildId}`);
        return candidates;
      }
      let deezerTrackId = deezerTrack.info?.identifier;

      // Check if we got a Deezer track or YouTube fallback
      const sourceName = deezerTrack.info?.sourceName || deezerTrack.pluginInfo?.source || "unknown";
      const uri = deezerTrack.info?.uri || "";

      // Try to extract Deezer ID from URI if we got YouTube fallback
      if (sourceName === "youtube" && uri.includes("deezer.com")) {
        const match = uri.match(/\/track\/(\d+)/);
        if (match) {
          deezerTrackId = match[1];
        }
      }

      // Only proceed if we have numeric Deezer ID
      if (deezerTrackId && /^\d+$/.test(deezerTrackId)) {
        // Get recommendations from Deezer using dzrec: prefix
        const deezerRecQuery = `dzrec:${deezerTrackId}`;
        const deezerRecTracks = await loadLavalinkTracks(deezerRecQuery);

        if (deezerRecTracks.length > 0) {
          const validTracks = filterValidSongs(deezerRecTracks).slice(0, 25);

          for (const track of validTracks) {
            candidates.push({
              artist: track.info?.author,
              title: track.info?.title,
              identifier: track.info?.identifier,
              duration: track.info?.length,
              source: "deezer_recommendations",
              track: track,
              genres: [],
              popularity: 0,
              releaseYear: null,
              features: null,
              score: 0,
            });
          }

          Log.info(
            "✅ Deezer recommendations collected",
            "",
            `guild=${guildId}`,
            `count=${validTracks.length}`,
            `deezerID=${deezerTrackId}`
          );
        }
      }
    }
  } catch (err) {
    Log.warning("❌ Failed to get Deezer recommendations", err.message, `guild=${guildId}`);
  }

  return candidates;
}

/**
 * Fetches Spotify recommendations via Spotify API
 * @param {Object} referenceTrack - Reference track object
 * @param {string} guildId - Guild identifier
 * @returns {Promise<Array>} Array of candidate tracks from Spotify
 */
async function fetchSpotifyCandidates(referenceTrack, guildId, profile) {
  const candidates = [];

  try {
    Log.info("🎵 Fetching Spotify recommendations", "", `guild=${guildId}`);

    const spotifyRecs = await getSpotifyBasedSuggestions(referenceTrack, profile);

    if (spotifyRecs && spotifyRecs.length > 0) {
      // Convert Spotify recommendations to playable tracks via Lavalink
      for (const rec of spotifyRecs) {
        try {
          // Use Spotify search via Lavalink (spsearch:)
          const spotifyQuery = `spsearch:${rec.artist} ${rec.title}`;
          const searchTracks = await loadLavalinkTracks(spotifyQuery);

          if (searchTracks.length > 0) {
            const track = getRelevantPlayableTrack(searchTracks, `${rec.artist} ${rec.title}`);
            if (!track) continue;
            candidates.push({
              artist: rec.artist,
              title: rec.title,
              identifier: track.info?.identifier,
              duration: track.info?.length,
              source: "spotify_recommendations",
              track: track,
              genres: rec.genres || [],
              popularity: rec.popularity || 0,
              releaseYear: rec.releaseYear || null,
              features: rec.features || null,
              score: 0,
            });
          }
        } catch (trackErr) {
          Log.debug("Failed to resolve Spotify track", trackErr.message);
        }
      }

      Log.info(
        "✅ Spotify recommendations collected",
        "",
        `guild=${guildId}`,
        `count=${candidates.length}`,
        `withGenres=${candidates.filter((c) => c.genres.length > 0).length}`
      );
    }
  } catch (err) {
    Log.warning("❌ Failed to get Spotify recommendations", err.message, `guild=${guildId}`);
  }

  return candidates;
}

function getLastFmExposureWeight(track, reference, exposure, now = Date.now()) {
  if (!exposure) return 0;

  const ttlMs = Math.max(Number(exposure.ttlMs) || 0, 1);
  const halfLifeMs = Math.max(ttlMs / 3, 60 * 60 * 1000);
  const freshness = (entry) => {
    if (!entry) return 0;
    const ageMs = Math.max(0, now - Number(entry.lastSeen || 0));
    return (Number(entry.count) || 1) * Math.exp(-ageMs / halfLifeMs);
  };

  const trackKey = getExposureKey(track);
  const referenceKey = getExposureKey({ title: reference.cleanTitle, artist: reference.searchArtist });
  const transitionKey = trackKey && referenceKey ? `${referenceKey}=>${trackKey}` : null;

  return freshness(getExposureRecord(exposure, trackKey)) + freshness(getExposureRecord(exposure, transitionKey, "transitions"));
}

async function fetchLastFmCandidates(reference, guildId, exposure = null) {
  const candidates = [];

  try {
    const similarTracks = await getLastFmSimilarTracks({
      artist: reference.searchArtist,
      title: reference.cleanTitle,
      limit: Math.max(LASTFM_AUTOPLAY_FETCH_LIMIT, LASTFM_AUTOPLAY_RESOLVE_LIMIT),
    });

    const maximumMatch = Math.max(...similarTracks.map((track) => Number(track.match) || 0), 0);

    // Last.fm returns a stable ordered list. Keep that order for fresh tracks,
    // but move recently exposed neighbours behind unseen ones before paying
    // the Lavalink resolution cost.
    const orderedSimilar = similarTracks
      .map((track, index) => ({ track, index }))
      .sort((left, right) => {
        const exposureDifference =
          getLastFmExposureWeight(left.track, reference, exposure) - getLastFmExposureWeight(right.track, reference, exposure);
        return exposureDifference || left.index - right.index;
      })
      .slice(0, Math.max(LASTFM_AUTOPLAY_RESOLVE_LIMIT, 1))
      .map(({ track }) => track);

    // Tags add useful genre evidence but Last.fm is a shared service. Eight
    // strong neighbours with a small worker pool are enough for a queue slot;
    // the wider pool gives exposure penalties room to create variety without
    // switching to an unrelated fallback.
    const resolved = await mapWithConcurrency(orderedSimilar, 2, async (similar) => {
        try {
          const query = `${similar.artist} ${similar.title}`;
          const tracks = await loadLavalinkTracks(`ytsearch:${query}`);
          const track = getRelevantPlayableTrack(tracks, query);
          if (!track) return null;

          const tagProfile = await getLastFmTagProfile({ artist: similar.artist, title: similar.title, limit: 8 });

          return {
            artist: similar.artist,
            title: similar.title,
            identifier: track.info?.identifier,
            duration: track.info?.length,
            source: "lastfm_similar",
            track,
            genres: tagProfile.tags,
            metadataConfidence: tagProfile.confidence,
            metadataProvider: tagProfile.source,
            // This is a collaborative-similarity signal, not catalog
            // popularity. Keeping it separate prevents a great match from
            // being penalized as an overplayed track.
            similarity: normalizeLastFmSimilarity(similar.match, maximumMatch),
            popularity: 0,
            releaseYear: null,
            features: null,
            score: 0,
          };
        } catch {
          return null;
        }
      });

    candidates.push(...resolved.filter(Boolean));
    Log.info("Last.fm similar candidates collected", "", `guild=${guildId}`, `count=${candidates.length}`);
  } catch (error) {
    Log.debug("Last.fm autoplay candidates failed", error.message);
  }

  return candidates;
}

function selectTagEnrichmentTargets(candidates, limit = 9) {
  const buckets = new Map();
  for (const candidate of candidates) {
    if (candidate.source === "lastfm_similar" || candidate.genres?.length || !candidate.artist || !candidate.title) continue;
    const source = candidate.source || "unknown";
    if (!buckets.has(source)) buckets.set(source, []);
    buckets.get(source).push(candidate);
  }

  const targets = [];
  while (targets.length < limit) {
    let added = false;
    for (const bucket of buckets.values()) {
      const candidate = bucket.shift();
      if (!candidate) continue;
      targets.push(candidate);
      added = true;
      if (targets.length === limit) break;
    }
    if (!added) break;
  }
  return targets;
}

async function enrichCandidatesWithLastFmTags(candidates, guildId, limit = 9) {
  const targets = selectTagEnrichmentTargets(candidates, limit);

  if (!targets.length) return candidates;

  await mapWithConcurrency(targets, 2, async (candidate) => {
    const tagProfile = await getLastFmTagProfile({ artist: candidate.artist, title: candidate.title, limit: 8 });
    if (tagProfile.tags.length) {
      candidate.genres = tagProfile.tags;
      candidate.metadataConfidence = Math.max(candidate.metadataConfidence || 0, tagProfile.confidence);
      candidate.metadataProvider ||= tagProfile.source;
    }
  });

  Log.info(
    "Last.fm candidate tags enriched",
    "",
    `guild=${guildId}`,
    `requested=${targets.length}`,
    `tagged=${targets.filter((candidate) => candidate.genres?.length).length}`
  );
  return candidates;
}

/**
 * Fetches YouTube Mix Radio candidates
 * @param {string} identifier - YouTube video identifier
 * @param {string} guildId - Guild identifier
 * @returns {Promise<Array>} Array of candidate tracks from YouTube Mix
 */
async function fetchYouTubeMixCandidates(identifier, guildId) {
  const candidates = [];
  const poru = getPoru();

  try {
    Log.info("🎵 Fetching YouTube Mix", "", `guild=${guildId}`);
    const radioQuery = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
    const radioRes = await poru.resolve({ query: radioQuery });

    if (radioRes?.tracks?.length > 1) {
      const validTracks = filterValidSongs(radioRes.tracks.slice(1, 21));

      validTracks.forEach((track) => {
        candidates.push({
          artist: track.info?.author,
          title: track.info?.title,
          identifier: track.info?.identifier,
          duration: track.info?.length,
          source: "youtube_mix",
          track: track,
          genres: [],
          popularity: 0,
          releaseYear: null,
          features: null,
          score: 0,
        });
      });

      Log.info("✅ YouTube Mix candidates collected", "", `guild=${guildId}`, `count=${validTracks.length}`);
    }
  } catch (err) {
    Log.warning("❌ Failed to get YouTube Mix", err.message, `guild=${guildId}`);
  }

  return candidates;
}

/**
 * Fetches YouTube search candidates as last resort
 * @param {string} cleanTitle - Cleaned track title
 * @param {string} searchArtist - Search artist name
 * @param {string} guildId - Guild identifier
 * @returns {Promise<Array>} Array of candidate tracks from YouTube search
 */
// Kept for future explicit user-requested search flows; broad provider search
// is deliberately excluded from automatic DJ fallback selection.
// eslint-disable-next-line no-unused-vars
async function fetchYouTubeSearchCandidates(cleanTitle, searchArtist, guildId) {
  const candidates = [];
  const poru = getPoru();

  try {
    Log.info("🎵 Trying YouTube search fallback", "", `guild=${guildId}`);
    const searchQuery = `ytsearch:${searchArtist} ${cleanTitle}`;
    const searchRes = await poru.resolve({ query: searchQuery });

    if (searchRes?.tracks?.length > 0) {
      const validTracks = filterValidSongs(searchRes.tracks).slice(0, 15);

      validTracks.forEach((track) => {
        candidates.push({
          artist: track.info?.author,
          title: track.info?.title,
          identifier: track.info?.identifier,
          duration: track.info?.length,
          source: "youtube_search",
          track: track,
          genres: [],
          popularity: 0,
          releaseYear: null,
          features: null,
          score: 0,
        });
      });

      Log.info("✅ YouTube search candidates collected", "", `guild=${guildId}`, `count=${validTracks.length}`);
    }
  } catch (err) {
    Log.warning("❌ Failed YouTube search", err.message, `guild=${guildId}`);
  }

  return candidates;
}

// eslint-disable-next-line no-unused-vars
async function fetchSoundCloudCandidates(searchArtist, guildId) {
  const candidates = [];

  try {
    const tracks = await loadLavalinkTracks(`scsearch:${searchArtist}`);
    const validTracks = filterValidSongs(tracks).slice(0, 15);

    validTracks.forEach((track) => {
      candidates.push({
        artist: track.info?.author,
        title: track.info?.title,
        identifier: track.info?.identifier,
        duration: track.info?.length,
        source: "soundcloud_search",
        track,
        genres: [],
        popularity: 0,
        releaseYear: null,
        features: null,
        score: 0,
      });
    });

    Log.info("✅ SoundCloud candidates collected", "", `guild=${guildId}`, `count=${validTracks.length}`);
  } catch (err) {
    Log.warning("❌ Failed SoundCloud search", err.message, `guild=${guildId}`);
  }

  return candidates;
}

/**
 * Fetches top artist search candidates as absolute last resort
 * @param {Object} profile - Session profile
 * @param {string} guildId - Guild identifier
 * @returns {Promise<Array>} Array of candidate tracks from top artist search
 */
// eslint-disable-next-line no-unused-vars
async function fetchTopArtistCandidates(profile, guildId) {
  const candidates = [];
  const poru = getPoru();

  if (profile.topArtists.length === 0) return candidates;

  const topArtist = profile.topArtists[0].artist;

  try {
    Log.info("🎵 Trying top artist search", "", `guild=${guildId}`, `artist=${topArtist}`);
    const searchRes = await poru.resolve({ query: `ytsearch:${topArtist}` });
    const validTracks = filterValidSongs(searchRes.tracks || []).slice(0, 10);

    validTracks.forEach((track) => {
      candidates.push({
        artist: track.info?.author,
        title: track.info?.title,
        identifier: track.info?.identifier,
        duration: track.info?.length,
        source: "top_artist_search",
        track: track,
        genres: [],
        popularity: 0,
        releaseYear: null,
        features: null,
        score: 0,
      });
    });

    Log.info("✅ Top artist candidates collected", "", `guild=${guildId}`, `count=${validTracks.length}`);
  } catch (err) {
    Log.warning("❌ Failed top artist search", err.message, `guild=${guildId}`);
  }

  return candidates;
}

/**
 * Collects candidate tracks from every available free source in parallel.
 * The final scorer decides between candidates using vibe, continuity,
 * popularity, diversity and skip history instead of hard-prioritizing a provider.
 *
 * @param {Object} referenceTrack - Reference track to base candidates on
 * @param {string} guildId - Guild identifier
 * @param {Object} profile - Session profile from buildSessionProfile
 * @returns {Promise<Array>} Array of candidate tracks
 */
async function collectCandidates(referenceTrack, guildId, profile, reference) {
  const { identifier } = referenceTrack.info;
  const { cleanTitle, searchArtist } = reference;

  // Only sources that provide an actual related/radio set may drive autoplay.
  // Broad artist searches were the source of most "fallback picked something
  // completely different" incidents, so they are intentionally not used here.
  const candidateSources = [
    ["deezer", () => fetchDeezerCandidates(guildId, cleanTitle, searchArtist)],
    ["lastfm", () => fetchLastFmCandidates(reference, guildId, profile.autoplayExposure)],
    ["youtubeMix", () => fetchYouTubeMixCandidates(identifier, guildId)],
  ];
  if (USE_SPOTIFY_AUTOPLAY) {
    candidateSources.push(["spotify", () => fetchSpotifyCandidates(referenceTrack, guildId, profile)]);
  }

  const sourceResults = await Promise.allSettled(candidateSources.map(([, load]) => load()));
  const allCandidates = sourceResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const deduplicatedCandidates = await enrichCandidatesWithLastFmTags(mergeCandidates(allCandidates), guildId);
  if (USE_DEEZER_METADATA) {
    await enrichCandidatesWithDeezerMetadata(deduplicatedCandidates, AUTOPLAY_DEEZER_METADATA_LIMIT);
  }

  Log.info(
    "📊 Candidate collection complete",
    "",
    `guild=${guildId}`,
    `raw=${allCandidates.length}`,
    `unique=${deduplicatedCandidates.length}`,
    `metadata=${deduplicatedCandidates.filter((candidate) => candidate.metadataConfidence > 0).length}`,
    `tempo=${deduplicatedCandidates.filter((candidate) => Number.isFinite(candidate.features?.tempo)).length}`,
    `sources=${[...new Set(allCandidates.map((candidate) => candidate.source))].join(",") || "none"}`
  );

  return deduplicatedCandidates;
}

/**
 * Resolves a candidate to a playable Poru track
 * @param {Object} candidate - Candidate track object
 * @param {string} guildId - Guild identifier
 * @returns {Promise<Object|null>} Poru track object or null
 */
async function resolveToPlayable(candidate, guildId, { referenceTitle = "" } = {}) {
  const candidateVersion = getAutoplayVersionCompatibility(candidate?.title, referenceTitle);
  if (!candidateVersion.allowed) {
    Log.debug(
      "Skipping unmatched alternate-version autoplay candidate",
      "",
      `guild=${guildId}`,
      `title=${formatLogValue(candidate.title)}`,
      `mode=${candidateVersion.mode}`
    );
    return null;
  }

  if (candidate.track) {
    const resolvedVersion = getAutoplayVersionCompatibility(candidate.track.info?.title, candidate.title);
    if (!resolvedVersion.allowed || (getVariantKinds(candidate.title).length && !getVariantKinds(candidate.track.info?.title).length)) {
      Log.debug(
        "Skipping mismatched alternate-version autoplay resolution",
        "",
        `guild=${guildId}`,
        `resolved=${formatLogValue(candidate.track.info?.title)}`,
        `mode=${resolvedVersion.mode}`
      );
      return null;
    }
    const directProviderIssue = getProviderValidationIssue(candidate, candidate.track);
    if (directProviderIssue) {
      Log.debug(
        "Skipping provider track with suspicious autoplay identity",
        "",
        `guild=${guildId}`,
        `reason=${directProviderIssue}`,
        `resolved=${formatLogValue(`${candidate.track.info?.author} - ${candidate.track.info?.title}`)}`
      );
      return null;
    }
    if (!matchesAutoplayCandidate(candidate, candidate.track)) {
      Log.debug(
        "Skipping provider track with mismatched canonical identity",
        "",
        `guild=${guildId}`,
        `expected=${formatLogValue(`${candidate.artist} - ${candidate.title}`)}`,
        `resolved=${formatLogValue(`${candidate.track.info?.author} - ${candidate.track.info?.title}`)}`
      );
      return null;
    }
    return applyCandidateMetadata(candidate.track, candidate);
  }

  const poru = getPoru();
  const searchTitle = getVariantKinds(candidate.title).length ? candidate.title : getBaseTitle(candidate.title);
  const searchQuery = `${candidate.artist} ${searchTitle}`;

  try {
    const searchRes = await poru.resolve({ query: `ytsearch:${searchQuery}` });
    const validTracks = filterValidSongs(searchRes.tracks || []);

    if (validTracks.length > 0) {
      const track = getRelevantPlayableTrack(validTracks, searchQuery);
      if (!track) return null;

      if (!getAutoplayVersionCompatibility(track.info?.title, candidate.title).allowed) {
        Log.debug(
          "Skipping mismatched resolved autoplay version",
          "",
          `guild=${guildId}`,
          `resolved=${formatLogValue(track.info?.title)}`,
          `requested=${formatLogValue(candidate.title)}`
        );
        return null;
      }
      const providerIssue = getProviderValidationIssue(candidate, track);
      if (providerIssue) {
        Log.debug(
          "Skipping resolved autoplay track with suspicious identity",
          "",
          `guild=${guildId}`,
          `reason=${providerIssue}`,
          `resolved=${formatLogValue(`${track.info?.author} - ${track.info?.title}`)}`
        );
        return null;
      }
      if (!matchesAutoplayCandidate(candidate, track)) {
        Log.debug(
          "Skipping resolved autoplay track with mismatched canonical identity",
          "",
          `guild=${guildId}`,
          `expected=${formatLogValue(`${candidate.artist} - ${candidate.title}`)}`,
          `resolved=${formatLogValue(`${track.info?.author} - ${track.info?.title}`)}`
        );
        return null;
      }

      applyCandidateMetadata(track, candidate);

      if (track.info?.identifier) {
        genreCache.set(track.info.identifier, {
          genres: candidate.genres || [],
          features: candidate.features || null,
          derivedFeatures: candidate.derivedFeatures || null,
          metadataConfidence: candidate.metadataConfidence || 0,
          metadataProvider: candidate.metadataProvider || null,
          metadataSources: candidate.metadataSources || [],
          releaseYear: candidate.releaseYear || null,
        });
      }

      Log.info(
        "Resolved candidate to playable track",
        "",
        `guild=${guildId}`,
        `query=${formatLogValue(searchQuery)}`,
        `genres=${candidate.genres?.join(", ") || "unknown"}`
      );

      return track;
    }
  } catch (err) {
    Log.error("Failed to resolve candidate", err, `guild=${guildId}`, `query=${formatLogValue(searchQuery)}`);
  }

  return null;
}

function partitionRankedCandidates(rankedCandidates) {
  const safe = [];
  const deferred = [];
  const fallback = [];

  for (const candidate of rankedCandidates) {
    if (candidate.hardRejected || candidate.score < 10) continue;
    if (candidate.fallbackOnly) {
      fallback.push(candidate);
      continue;
    }
    (candidate.deferred ? deferred : safe).push(candidate);
  }

  return { safe, deferred, fallback };
}

function getTransitionQuality(candidate, profile = {}) {
  const referenceFeatures = {
    ...(profile.avgDerivedFeatures || {}),
    ...(profile.avgFeatures || {}),
    ...(profile.referenceDerivedFeatures || {}),
    ...(profile.referenceFeatures || {}),
  };
  const hasReferenceFeatures = Object.keys(referenceFeatures).length > 0;
  const candidateFeatures = { ...(candidate?.derivedFeatures || {}), ...(candidate?.features || {}) };
  const referenceFamilies = profile.referenceGenreFamilies || [];
  const candidateFamilies = candidate?.genreFamilies || getGenreFamilies(candidate?.genres || []);
  let quality = 0;
  let evidenceSignals = 0;

  const genreCompatibility = areGenreFamiliesCompatible(referenceFamilies, candidateFamilies);
  if (genreCompatibility === true) {
    quality += 3;
    evidenceSignals += 1;
  }
  if (genreCompatibility === false) quality -= 6;

  if (hasReferenceFeatures && Number.isFinite(Number(candidateFeatures.tempo)) && Number.isFinite(Number(referenceFeatures.tempo))) {
    const tempoDistance = getTempoDistance(candidateFeatures.tempo, referenceFeatures.tempo);
    if (tempoDistance < 10) {
      quality += 6;
      evidenceSignals += 1;
    } else if (tempoDistance < 22) {
      quality += 3;
      evidenceSignals += 1;
    }
    else if (tempoDistance > 40) quality -= 6;
  }

  for (const [field, good, bad] of [
    ["energy", 5, -6],
    ["valence", 4, -5],
  ]) {
    if (!hasReferenceFeatures || !Number.isFinite(Number(candidateFeatures[field])) || !Number.isFinite(Number(referenceFeatures[field]))) continue;
    const difference = Math.abs(Number(candidateFeatures[field]) - Number(referenceFeatures[field]));
    if (difference < 0.15) {
      quality += good;
      evidenceSignals += 1;
    }
    else if (difference > 0.4) quality += bad;
  }

  if (Number(candidate?.similarity) >= 0.72) evidenceSignals += 1;
  if (getFeatureCoverage(candidate?.features) > 0) quality += 1;
  // Do not label a transition as high quality from a lone BPM reading or a
  // generic provider score. It needs two independent pieces of evidence.
  if (evidenceSignals < 2) quality = Math.min(quality, AUTOPLAY_TRANSITION_QUALITY_MIN - 1);
  return quality;
}

function applyTransitionQualityGuard(rankedCandidates, profile = {}) {
  const initialPools = partitionRankedCandidates(rankedCandidates);
  const qualityGuardActive =
    Number(profile.autoplayStreak) >= AUTOPLAY_TRANSITION_QUALITY_GUARD_AFTER && initialPools.safe.length > 0;
  const hasHighQualityAlternative = initialPools.safe.some(
    (candidate) => Number(candidate.transitionQuality) >= AUTOPLAY_TRANSITION_QUALITY_MIN
  );

  if (qualityGuardActive && hasHighQualityAlternative) {
    for (const candidate of initialPools.safe) {
      if (
        Number(candidate.transitionQuality) < AUTOPLAY_TRANSITION_QUALITY_MIN &&
        !candidate.manualAnchorEvidence
      ) {
        candidate.deferred = true;
        candidate.deferredReason = "transition-quality-low";
        candidate.emergencyEligible = false;
        candidate.scoringDetails.push(`transition:defer(<${AUTOPLAY_TRANSITION_QUALITY_MIN})`);
      }
    }
  }

  return rankedCandidates;
}

function getDiversifiedResolutionOrder(rankedCandidates, random = Math.random) {
  const { safe, deferred } = partitionRankedCandidates(rankedCandidates);
  if (safe.length < 2 || AUTOPLAY_DIVERSITY_POOL_SIZE < 2) return [...safe, ...deferred];

  const topScore = safe[0].score;
  const topQuality = Number(safe[0].transitionQuality) || 0;
  const minimumScore = topScore - AUTOPLAY_DIVERSITY_SCORE_BAND;
  const pool = safe
    .filter((candidate) => {
      if (candidate.score < minimumScore) return false;
      const scoreDrop = topScore - candidate.score;
      if (scoreDrop <= AUTOPLAY_SELECTION_MAX_SCORE_DROP) return true;
      return (Number(candidate.transitionQuality) || 0) >= topQuality + AUTOPLAY_SELECTION_QUALITY_ADVANTAGE;
    })
    .slice(0, AUTOPLAY_DIVERSITY_POOL_SIZE);
  if (pool.length < 2) return rankedCandidates;

  const floor = topScore - AUTOPLAY_DIVERSITY_SCORE_BAND;
  const weights = pool.map((candidate) => Math.max(1, candidate.score - floor + 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const roll = Math.min(Math.max(Number(random()) || 0, 0), 0.999999) * totalWeight;
  let cursor = 0;
  let selected = pool[0];

  for (let index = 0; index < pool.length; index += 1) {
    cursor += weights[index];
    if (roll < cursor) {
      selected = pool[index];
      break;
    }
  }

  return [selected, ...safe.filter((candidate) => candidate !== selected), ...deferred];
}

function hasSessionVibeAnchor(profile = {}) {
  return hasReliableSessionVibe(profile);
}

/**
 * YouTube Mix is the final provider-relationship fallback for obscure tracks
 * and temporary metadata outages. It can run only after normal and stable
 * anchor candidates are exhausted, and it must not contradict any known
 * current/manual genre family.
 */
function getMetadataFreeYouTubeMixFallbackCandidates(rankedCandidates, profile) {
  const referenceFamilies = profile.referenceGenreFamilies || [];
  const manualFamilies = profile.manualTasteGenreFamilies?.length
    ? profile.manualTasteGenreFamilies
    : profile.manualAnchorGenreFamilies || [];

  return rankedCandidates.filter(
    (candidate) => {
      const candidateFamilies = candidate.genreFamilies || getGenreFamilies(candidate.genres || []);
      const referenceCompatibility = areGenreFamiliesCompatible(referenceFamilies, candidateFamilies);
      const manualCompatibility = areGenreFamiliesCompatible(manualFamilies, candidateFamilies);
      return (
      candidate.source === "youtube_mix" &&
      candidate.track &&
      !candidate.hardRejected &&
      !candidate.deferred &&
      candidate.fallbackOnly &&
      candidate.rejectionReason === "metadata-free-mix-fallback" &&
      candidate.score >= AUTOPLAY_MIX_FALLBACK_MIN_SCORE &&
      referenceCompatibility !== false &&
      manualCompatibility !== false &&
      getAutoplayVersionCompatibility(candidate.title, profile.referenceTitleRaw || "").allowed
      );
    }
  );
}

async function resolveMetadataFreeYouTubeMixFallback(candidates, profile, skipPatterns, guildId, fallbackAnchor = null) {
  if (!candidates.length) return null;

  const rankedCandidates = scoreCandidates(candidates, profile, skipPatterns, guildId);
  const mixCandidates = getMetadataFreeYouTubeMixFallbackCandidates(rankedCandidates, profile);
  if (!mixCandidates.length) return null;

  Log.warning(
    "Autoplay using direct YouTube Mix fallback",
    "",
    `guild=${guildId}`,
    `candidates=${mixCandidates.length}`,
    `reason=${hasSessionVibeAnchor(profile) ? "catalog-candidates-exhausted" : "no-session-vibe-metadata"}`
  );

  for (const candidate of mixCandidates) {
    const playableTrack = await resolveToPlayable(candidate, guildId, { referenceTitle: profile.referenceTitleRaw || "" });
    if (!playableTrack) continue;

    Log.info(
      "Smart autoplay track selected from metadata-free YouTube Mix",
      "",
      `guild=${guildId}`,
      `track=${playableTrack.info?.title}`,
      `artist=${playableTrack.info?.author}`,
      `canonical=${candidate.artist} - ${candidate.title}`,
      `source=${candidate.source}`
    );
    return attachFallbackOrigin(playableTrack, fallbackAnchor);
  }

  Log.warning("Metadata-free YouTube Mix fallback exhausted", "", `guild=${guildId}`, `candidates=${mixCandidates.length}`);
  return null;
}

async function resolveRankedCandidates(
  rankedCandidates,
  guildId,
  context = "primary",
  { deferredOnly = false, referenceTitle = "", requireManualAnchor = false } = {}
) {
  const { safe, deferred } = partitionRankedCandidates(rankedCandidates);

  const emergencyPool = deferred
    .filter((candidate) => candidate.emergencyEligible !== false)
    .filter((candidate) => !requireManualAnchor || candidate.manualAnchorEvidence);
  const pools = deferredOnly ? [["artist-streak emergency", emergencyPool]] : [["safe", safe]];
  for (const [pool, candidates] of pools) {
    for (const candidate of candidates) {
      const playableTrack = await resolveToPlayable(candidate, guildId, { referenceTitle });
      if (!playableTrack) continue;

      if (pool !== "safe") {
        Log.warning(
          "Autoplay used deferred candidate",
          "",
          `guild=${guildId}`,
          `track=${candidate.artist} - ${candidate.title}`,
          `reason=${candidate.deferredReason || "artist-streak"}`
        );
      }

      Log.info(
        "Smart autoplay track selected",
        "",
        `guild=${guildId}`,
        `track=${playableTrack.info?.title}`,
        `artist=${playableTrack.info?.author}`,
        `canonical=${candidate.artist} - ${candidate.title}`,
        `genres=${candidate.genres?.join(", ") || "unknown"}`,
        `tempo=${candidate.features?.tempo ? Math.round(candidate.features.tempo) : "unknown"}BPM`,
        `energy=${candidate.features?.energy ? candidate.features.energy.toFixed(2) : "unknown"}`,
        `score=${candidate.score}`,
        `source=${candidate.source}`,
        `context=${context}`
      );

      return playableTrack;
    }
  }

  return null;
}

function getStableFallbackAnchor(profile, referenceTrack) {
  if (!hasReliableSessionVibe(profile)) return null;
  const current = getAutoplayReference(referenceTrack);
  const previousTracks = (profile.recentTracks || []).slice(0, -1).reverse();
  const orderedAnchors = previousTracks.filter((track) => !isAutoplayTrack(track));
  const sessionFamilies = profile.manualTasteGenreFamilies?.length
    ? profile.manualTasteGenreFamilies
    : getGenreFamilies((profile.topGenres || []).map((genre) => genre.genre));

  return orderedAnchors.find((track) => {
    const reference = getAutoplayReference(track);
    const anchorGenres = track?.userData?.genres || [];
    const featureCoverage = getFeatureCoverage({ ...(track?.userData?.derivedFeatures || {}), ...(track?.userData?.features || {}) });
    const metadataConfidence = Number(track?.userData?.metadataConfidence) || 0;
    const hasMetadata = Boolean(
      normalizeGenreTags(anchorGenres).length || featureCoverage >= 2 || (featureCoverage >= 1 && metadataConfidence >= 0.8)
    );
    const compatibleWithSession =
      !sessionFamilies.length || areGenreFamiliesCompatible(sessionFamilies, getGenreFamilies(anchorGenres)) !== false;
    const isSameTrack =
      reference.cleanTitle.toLowerCase() === current.cleanTitle.toLowerCase() &&
      reference.searchArtist.toLowerCase() === current.searchArtist.toLowerCase();

    return hasMetadata && compatibleWithSession && !isSameTrack && reference.cleanTitle && reference.searchArtist;
  }) || null;
}

function createStableAnchorProfile(profile, fallbackAnchor) {
  const metadata = getTrackMetadata(fallbackAnchor);
  return {
    ...profile,
    referenceGenres: metadata.genres,
    referenceGenreFamilies: getGenreFamilies(metadata.genres),
    referenceFeatures: metadata.features,
    referenceDerivedFeatures: metadata.derivedFeatures,
    referenceMetadataConfidence: metadata.metadataConfidence,
    referenceMetadataProvider: metadata.metadataProvider,
    referenceMetadataSources: metadata.metadataSources,
    referenceTitleRaw: fallbackAnchor?.info?.title || "",
    referenceIsManual: !isAutoplayTrack(fallbackAnchor),
    referenceIsAutoplay: isAutoplayTrack(fallbackAnchor),
  };
}

function getFallbackOriginAnchor(referenceTrack) {
  const anchor = referenceTrack?.userData?.autoplayFallbackAnchor;
  if (!anchor?.info?.title || !anchor?.info?.author) return null;

  return {
    info: { ...anchor.info },
    userData: { ...(anchor.userData || {}) },
  };
}

function createFallbackAnchor(track) {
  if (!track?.info?.title || !track?.info?.author) return null;
  return {
    info: {
      title: track.info.title,
      author: track.info.author,
      identifier: track.info.identifier,
      sourceName: track.info.sourceName,
      uri: track.info.uri,
      length: track.info.length,
    },
    userData: {
      autoplayReference: track.userData?.autoplayReference,
      genres: track.userData?.genres || [],
      features: track.userData?.features || null,
      derivedFeatures: track.userData?.derivedFeatures || null,
      metadataConfidence: track.userData?.metadataConfidence || 0,
      metadataProvider: track.userData?.metadataProvider || null,
      metadataSources: track.userData?.metadataSources || [],
      releaseYear: track.userData?.releaseYear || null,
    },
  };
}

function attachFallbackOrigin(track, fallbackAnchor) {
  const anchor = createFallbackAnchor(fallbackAnchor);
  if (!track || !anchor) return track;
  track.userData = {
    ...(track.userData || {}),
    autoplayFallback: "youtube-mix",
    autoplayFallbackAnchor: anchor,
  };
  return track;
}

async function scoreAndResolveCandidates(candidates, profile, skipPatterns, guildId, context, resolutionOptions) {
  if (!candidates.length) return null;
  if (USE_SPOTIFY_METADATA) await enrichCandidatesWithSpotifyMetadata(candidates, candidates.length);

  const rankedCandidates = scoreCandidates(candidates, profile, skipPatterns, guildId, {
    ...(resolutionOptions || {}),
    anchorTrusted: Boolean(resolutionOptions?.anchorTrusted),
  });
  rankedCandidates.forEach((candidate) => {
    candidate.transitionQuality = getTransitionQuality(candidate, profile);
  });

  applyTransitionQualityGuard(rankedCandidates, profile);

  const { safe, deferred } = partitionRankedCandidates(rankedCandidates);
  const resolutionOrder = getDiversifiedResolutionOrder(rankedCandidates);
  const safeCandidates = new Set(safe);
  const resolutionProbe = resolutionOrder.find((candidate) => safeCandidates.has(candidate));
  const selectedRank = rankedCandidates.indexOf(resolutionProbe) + 1;
  const rejectionCounts = rankedCandidates.reduce((counts, candidate) => {
    if (!candidate.hardRejected) return counts;
    const reason = candidate.rejectionReason || "unknown";
    counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});
  const rejectionSummary = Object.entries(rejectionCounts)
    .sort(([, left], [, right]) => right - left)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(",");

  for (const candidate of deferred) {
    Log.info(
      candidate.deferredReason === "manual-anchor-unverified"
        ? "Autoplay deferred low-confidence drift candidate"
        : candidate.deferredReason === "transition-quality-low"
          ? "Autoplay deferred low-quality transition"
          : "Autoplay deferred repeated artist",
      "",
      `guild=${guildId}`,
      `track=${candidate.artist} - ${candidate.title}`,
      `reason=${candidate.deferredReason || "artist-streak"}`,
      `context=${context}`
    );
  }

  Log.info(
    "Top candidates scored",
    "",
    `guild=${guildId}`,
    `winner=${resolutionProbe ? `${resolutionProbe.artist} - ${resolutionProbe.title} (${resolutionProbe.score})` : "none"}`,
    `resolutionProbe=${resolutionProbe?.artist} - ${resolutionProbe?.title} (${resolutionProbe?.score})`,
    `selectedRank=${selectedRank || "none"}`,
    `scoreDelta=${resolutionProbe ? Number((rankedCandidates[0].score - resolutionProbe.score).toFixed(2)) : "none"}`,
    `transitionQuality=${resolutionProbe?.transitionQuality ?? "unknown"}`,
    `safe=${safe.length}`,
    `deferred=${deferred.length}`,
    `rejections=${rejectionSummary || "none"}`,
    `scoring=${resolutionProbe?.scoringDetails?.join(", ") || "none"}`
  );
  Log.debug(
    "Runner-ups",
    "",
    `#1=${formatCandidateDiagnostic(rankedCandidates[0])}`,
    `#2=${formatCandidateDiagnostic(rankedCandidates[1])}`,
    `#3=${formatCandidateDiagnostic(rankedCandidates[2])}`
  );

  const resolvedTrack = await resolveRankedCandidates(resolutionOrder, guildId, context, {
    ...(resolutionOptions || {}),
    referenceTitle: profile.referenceTitleRaw || "",
  });
  if (resolvedTrack) {
    Log.info(
      "Autoplay final resolution",
      "",
      `guild=${guildId}`,
      `track=${formatLogValue(resolvedTrack.info?.author)} - ${formatLogValue(resolvedTrack.info?.title)}`,
      `context=${context}`
    );
  }
  return resolvedTrack;
}

async function fetchSmartAutoplayTrack(referenceTrack, guildId, { pendingManualTracks = [] } = {}) {
  if (!referenceTrack?.info) return null;

  const guildSettings = getGuildState(guildId);
  if (!guildSettings?.autoplay) return null;

  const fallbackOrigin = getFallbackOriginAnchor(referenceTrack);
  Log.info(
    "Starting smart autoplay",
    "",
    `guild=${guildId}`,
    `reference=${referenceTrack.info.title}`,
    fallbackOrigin ? `fallbackAnchor=${fallbackOrigin.info.author} - ${fallbackOrigin.info.title}` : ""
  );

  // Last.fm tags are the default genre anchor because the Spotify endpoints
  // needed for audio metadata are unavailable to most development-mode apps.
  // A metadata-free Mix selection is a transport layer, not a new taste
  // anchor. Keep querying from the original manual/stable track until a
  // catalog-backed recommendation can establish a real next reference.
  const referenceSource = fallbackOrigin || referenceTrack;
  let reference = getAutoplayReference(referenceSource);
  let referenceTagProfile = await getLastFmTagProfile({
    artist: reference.searchArtist,
    title: reference.cleanTitle,
    limit: 10,
  });
  if (!referenceTagProfile.tags.length) {
    const canonicalReference = await resolveCanonicalReference(reference.cleanTitle, reference.searchArtist, guildId);
    if (canonicalReference) {
      reference = canonicalReference;
      referenceTagProfile = await getLastFmTagProfile({ artist: reference.searchArtist, title: reference.cleanTitle, limit: 10 });
    }
  }

  const referenceMetadata = {
    artist: reference.searchArtist,
    title: reference.cleanTitle,
    identifier: referenceSource.info?.identifier,
    track: referenceSource,
    genres: referenceSource.userData?.genres || [],
    features: referenceSource.userData?.features || null,
  };
  if (referenceTagProfile.tags.length > 0) {
    referenceMetadata.genres = referenceTagProfile.tags;
    referenceMetadata.metadataConfidence = referenceTagProfile.confidence;
    referenceMetadata.metadataProvider = referenceTagProfile.source;
  }
  if (USE_DEEZER_METADATA) await enrichCandidateWithAutoplayMetadata(referenceMetadata);
  if (USE_SPOTIFY_METADATA) await enrichCandidatesWithSpotifyMetadata([referenceMetadata], 1);
  referenceTrack.userData = {
    ...(referenceTrack.userData || {}),
    autoplayReference: { title: reference.cleanTitle, artist: reference.searchArtist },
    genres: referenceMetadata.genres,
    moodTags: referenceMetadata.moodTags || [],
    features: referenceMetadata.features,
    derivedFeatures: referenceMetadata.derivedFeatures || null,
    metadataConfidence: referenceMetadata.metadataConfidence || 0,
    metadataProvider: referenceMetadata.metadataProvider || null,
    metadataSources: referenceMetadata.metadataSources || [],
    releaseYear: referenceMetadata.releaseYear,
  };
  if (referenceMetadata.genres?.length || referenceMetadata.features || referenceMetadata.derivedFeatures) {
    genreCache.set(referenceTrack.info.identifier, {
      genres: referenceMetadata.genres,
      features: referenceMetadata.features,
      derivedFeatures: referenceMetadata.derivedFeatures || null,
      metadataConfidence: referenceMetadata.metadataConfidence || 0,
      metadataProvider: referenceMetadata.metadataProvider || null,
      metadataSources: referenceMetadata.metadataSources || [],
      releaseYear: referenceMetadata.releaseYear,
    });
  }

  await enrichManualAnchorTracks(pendingManualTracks, guildId);

  const profile = buildSessionProfile(guildId, referenceTrack, { pendingManualTracks });
  profile.guildId = guildId;
  profile.referenceTitleRaw = referenceTrack.info?.title || reference.cleanTitle;
  profile.autoplayReferenceKey = getExposureKey(referenceTrack);
  profile.autoplayExposure = await getAutoplayExposureSnapshot(guildId);

  const timeOfDay = getTimeOfDayFactor();

  Log.info(
    "Session profile built",
    "",
    `guild=${guildId}`,
    `tracks=${profile.totalTracks}`,
    `topArtist=${profile.topArtists[0]?.artist || "none"}`,
    `topGenres=${profile.topGenres
      .slice(0, 3)
      .map((g) => `${g.genre}(${g.count})`)
      .join(", ")}`,
    `avgTempo=${profile.avgTempo ? Math.round(profile.avgTempo) : "unknown"}BPM`,
    `avgYear=${profile.avgYear || "unknown"}`,
    `energyTrend=${profile.energyTrend || "unknown"}`,
    `manualAnchors=${profile.manualAnchorRecords?.length || 0}`,
    `pendingManual=${profile.pendingManualTracks?.length || 0}`,
    `autoplayStreak=${profile.autoplayStreak || 0}`,
    `timeOfDay=${timeOfDay.period}`
  );

  const skipPatterns = getSkipPatterns(guildId);

  const candidates = await collectCandidates(referenceTrack, guildId, profile, reference);

  Log.info("Candidates collected", "", `guild=${guildId}`, `total=${candidates.length}`);
  const playableTrack = await scoreAndResolveCandidates(candidates, profile, skipPatterns, guildId, "reference");
  if (playableTrack) return playableTrack;

  // A metadata-free Mix result is not allowed to become the next radio seed.
  // Its stored manual/stable origin remains the anchor until the catalog can
  // verify a normal transition again.
  const fallbackAnchor = getFallbackOriginAnchor(referenceTrack) || getStableFallbackAnchor(profile, referenceTrack);
  if (fallbackAnchor) {
    const fallbackReference = getAutoplayReference(fallbackAnchor);
    const fallbackProfile = createStableAnchorProfile(profile, fallbackAnchor);
    Log.warning(
      "Autoplay retrying from stable session anchor",
      "",
      `guild=${guildId}`,
      `failedReference=${reference.searchArtist} - ${reference.cleanTitle}`,
      `anchor=${fallbackReference.searchArtist} - ${fallbackReference.cleanTitle}`
    );
    const fallbackCandidates = await collectCandidates(fallbackAnchor, guildId, fallbackProfile, fallbackReference);
    const fallbackTrack = await scoreAndResolveCandidates(
      fallbackCandidates,
      fallbackProfile,
      skipPatterns,
      guildId,
      "stable-anchor-fallback",
      { anchorTrusted: true }
    );
    if (fallbackTrack) return fallbackTrack;

    const anchoredMixTrack = await resolveMetadataFreeYouTubeMixFallback(
      fallbackCandidates,
      fallbackProfile,
      skipPatterns,
      guildId,
      fallbackAnchor
    );
    if (anchoredMixTrack) return anchoredMixTrack;
  }

  // Obscure uploads (especially meme music) can be absent from Last.fm and
  // audio-feature catalogs. In that fully metadata-free case, YouTube's own
  // Mix is the closest available radio signal. It is deliberately the last
  // non-emergency lane so it cannot override a stable, already-vetted anchor.
  const mixFallbackTrack = await resolveMetadataFreeYouTubeMixFallback(candidates, profile, skipPatterns, guildId, referenceTrack);
  if (mixFallbackTrack) return mixFallbackTrack;

  // A same-artist third track may keep a room alive, but only after every
  // safe candidate from both the current and stable-anchor pools failed.
  const emergencyTrack = await scoreAndResolveCandidates(candidates, profile, skipPatterns, guildId, "artist-streak-emergency", {
    deferredOnly: true,
    requireManualAnchor: profile.autoplayStreak >= 1,
  });
  if (emergencyTrack) return emergencyTrack;

  Log.warning("Failed to resolve any candidate to playable track", "", `guild=${guildId}`);
  return null;
}

module.exports = {
  fetchSmartAutoplayTrack,
  cleanTrackInfo,
  getAutoplayReference,
  applyCandidateMetadata,
  selectTagEnrichmentTargets,
  partitionRankedCandidates,
  getTransitionQuality,
  applyTransitionQualityGuard,
  getDiversifiedResolutionOrder,
  hasSessionVibeAnchor,
  getMetadataFreeYouTubeMixFallbackCandidates,
  resolveMetadataFreeYouTubeMixFallback,
  resolveRankedCandidates,
  getStableFallbackAnchor,
  createStableAnchorProfile,
  getFallbackOriginAnchor,
  attachFallbackOrigin,
  enrichCandidatesWithLastFmTags,
  getRelevantPlayableTrack,
  matchesAutoplayCandidate,
  getProviderValidationIssue,
  resolveToPlayable,
  candidateKey,
  mergeCandidates,
};
