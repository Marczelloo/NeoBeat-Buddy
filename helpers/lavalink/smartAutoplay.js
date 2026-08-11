const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { getAutoplayExposureSnapshot, getExposureKey, getExposureRecord } = require("./autoplayExposure");
const { scoreCandidates, getTimeOfDayFactor } = require("./candidateScoring");
const { areGenreFamiliesCompatible, getGenreFamilies, normalizeGenreTags } = require("./genreUtils");
const { getLastFmSimilarTracks, getLastFmTrackTags } = require("./lastfmClient");
const { getPoru } = require("./players");
const { filterPlayableSearchResults, rankSearchResults } = require("./searchRanking");
const { buildSessionProfile, genreCache } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const {
  getSpotifyBasedSuggestions,
  enrichCandidatesWithSpotifyMetadata,
} = require("./spotifyRecommendations");
const { cleanTrackMetadata, getBaseTitle, getVariantKinds, isUnrequestedAlternateVersion } = require("./trackNormalization");
const { filterValidSongs } = require("./trackValidation");

const USE_SPOTIFY_AUTOPLAY = process.env.USE_SPOTIFY_AUTOPLAY === "true";
const USE_SPOTIFY_METADATA = process.env.USE_SPOTIFY_METADATA === "true";
const LASTFM_AUTOPLAY_FETCH_LIMIT = Number(process.env.LASTFM_AUTOPLAY_FETCH_LIMIT ?? 18);
const LASTFM_AUTOPLAY_RESOLVE_LIMIT = Number(process.env.LASTFM_AUTOPLAY_RESOLVE_LIMIT ?? 12);
const AUTOPLAY_DIVERSITY_POOL_SIZE = Number(process.env.AUTOPLAY_DIVERSITY_POOL_SIZE ?? 8);
const AUTOPLAY_DIVERSITY_SCORE_BAND = Number(process.env.AUTOPLAY_DIVERSITY_SCORE_BAND ?? 12);
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
    // Autonomous recommendations must start from canonical recordings. A user
    // can explicitly request a version through normal search, but DJ mode
    // should not silently turn a radio track into a remix/live/acoustic cut.
    if (getVariantKinds(candidate.title).length) continue;

    const key = candidateKey(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...candidate,
        genres: normalizeGenreTags(candidate.genres, { artist: candidate.artist, title: candidate.title }),
      });
      continue;
    }

    existing.genres = normalizeGenreTags([...(existing.genres || []), ...(candidate.genres || [])], {
      artist: existing.artist,
      title: existing.title,
    });
    existing.features ||= candidate.features;
    existing.similarity = Math.max(existing.similarity || 0, candidate.similarity || 0);
    existing.popularity = Math.max(existing.popularity || 0, candidate.popularity || 0);
    existing.releaseYear ||= candidate.releaseYear;
    existing.track ||= candidate.track;
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
  if (candidate.features) track.userData.features = candidate.features;
  if (candidate.releaseYear) track.userData.releaseYear = candidate.releaseYear;

  return track;
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
      const deezerTrack = deezerSearchTracks[0];
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

          const genres = await getLastFmTrackTags({ artist: similar.artist, title: similar.title, limit: 8 });

          return {
            artist: similar.artist,
            title: similar.title,
            identifier: track.info?.identifier,
            duration: track.info?.length,
            source: "lastfm_similar",
            track,
            genres,
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
    const tags = await getLastFmTrackTags({ artist: candidate.artist, title: candidate.title, limit: 8 });
    if (tags.length) candidate.genres = tags;
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

  Log.info(
    "📊 Candidate collection complete",
    "",
    `guild=${guildId}`,
    `raw=${allCandidates.length}`,
    `unique=${deduplicatedCandidates.length}`,
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
async function resolveToPlayable(candidate, guildId) {
  if (getVariantKinds(candidate?.title).length) {
    Log.debug("Skipping alternate-version autoplay candidate", "", `guild=${guildId}`, `title=${formatLogValue(candidate.title)}`);
    return null;
  }

  if (candidate.track) {
    const query = `${candidate.artist} ${getBaseTitle(candidate.title)}`.trim();
    if (isUnrequestedAlternateVersion(candidate.track.info?.title, query)) {
      Log.debug("Skipping alternate-version autoplay resolution", "", `guild=${guildId}`, `resolved=${formatLogValue(candidate.track.info?.title)}`);
      return null;
    }
    return applyCandidateMetadata(candidate.track, candidate);
  }

  const poru = getPoru();
  const searchQuery = `${candidate.artist} ${getBaseTitle(candidate.title)}`;

  try {
    const searchRes = await poru.resolve({ query: `ytsearch:${searchQuery}` });
    const validTracks = filterValidSongs(searchRes.tracks || []);

    if (validTracks.length > 0) {
      const track = getRelevantPlayableTrack(validTracks, searchQuery);
      if (!track) return null;

      applyCandidateMetadata(track, candidate);

      if (track.info?.identifier) {
        genreCache.set(track.info.identifier, {
          genres: candidate.genres || [],
          features: candidate.features || null,
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

  for (const candidate of rankedCandidates) {
    if (candidate.hardRejected || candidate.score < 10) continue;
    (candidate.deferred ? deferred : safe).push(candidate);
  }

  return { safe, deferred };
}

function getDiversifiedResolutionOrder(rankedCandidates, random = Math.random) {
  const { safe, deferred } = partitionRankedCandidates(rankedCandidates);
  if (safe.length < 2 || AUTOPLAY_DIVERSITY_POOL_SIZE < 2) return rankedCandidates;

  const topScore = safe[0].score;
  const pool = safe
    .filter((candidate) => candidate.score >= topScore - AUTOPLAY_DIVERSITY_SCORE_BAND)
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
  return Boolean(
    profile.referenceGenreFamilies?.length ||
      profile.referenceGenres?.length ||
      profile.referenceFeatures ||
      profile.topGenres?.length ||
      profile.avgFeatures
  );
}

/**
 * YouTube Mix is a useful radio signal for obscure or meme uploads which have
 * no catalog metadata at all. It is deliberately not a general escape hatch:
 * only direct Mix tracks rejected exclusively for missing metadata can enter
 * this pool, and only when the room itself has no usable vibe anchor.
 */
function getMetadataFreeYouTubeMixFallbackCandidates(rankedCandidates, profile) {
  if (hasSessionVibeAnchor(profile)) return [];

  return rankedCandidates.filter(
    (candidate) =>
      candidate.source === "youtube_mix" &&
      candidate.track &&
      !candidate.deferred &&
      candidate.rejectionReason === "unverified-provider-candidate" &&
      getVariantKinds(candidate.title).length === 0
  );
}

async function resolveMetadataFreeYouTubeMixFallback(candidates, profile, skipPatterns, guildId) {
  if (!candidates.length || hasSessionVibeAnchor(profile)) return null;

  const rankedCandidates = scoreCandidates(candidates, profile, skipPatterns, guildId);
  const mixCandidates = getMetadataFreeYouTubeMixFallbackCandidates(rankedCandidates, profile);
  if (!mixCandidates.length) return null;

  Log.warning(
    "Autoplay using metadata-free YouTube Mix fallback",
    "",
    `guild=${guildId}`,
    `candidates=${mixCandidates.length}`,
    "reason=no-session-vibe-metadata"
  );

  for (const candidate of mixCandidates) {
    const playableTrack = await resolveToPlayable(candidate, guildId);
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
    return playableTrack;
  }

  Log.warning("Metadata-free YouTube Mix fallback exhausted", "", `guild=${guildId}`, `candidates=${mixCandidates.length}`);
  return null;
}

async function resolveRankedCandidates(rankedCandidates, guildId, context = "primary", { deferredOnly = false } = {}) {
  const { safe, deferred } = partitionRankedCandidates(rankedCandidates);

  const pools = deferredOnly ? [["artist-streak emergency", deferred]] : [["safe", safe]];
  for (const [pool, candidates] of pools) {
    for (const candidate of candidates) {
      const playableTrack = await resolveToPlayable(candidate, guildId);
      if (!playableTrack) continue;

      if (pool !== "safe") {
        Log.warning(
          "Autoplay used deferred same-artist candidate",
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
  const current = getAutoplayReference(referenceTrack);
  const previousTracks = (profile.recentTracks || []).slice(0, -1).reverse();
  const sessionFamilies = getGenreFamilies((profile.topGenres || []).map((genre) => genre.genre));

  return previousTracks.find((track) => {
    const reference = getAutoplayReference(track);
    const anchorGenres = track?.userData?.genres || [];
    const hasMetadata = Boolean(anchorGenres.length || track?.userData?.features);
    const compatibleWithSession =
      !sessionFamilies.length || areGenreFamiliesCompatible(sessionFamilies, getGenreFamilies(anchorGenres)) !== false;
    const isSameTrack =
      reference.cleanTitle.toLowerCase() === current.cleanTitle.toLowerCase() &&
      reference.searchArtist.toLowerCase() === current.searchArtist.toLowerCase();

    return hasMetadata && compatibleWithSession && !isSameTrack && reference.cleanTitle && reference.searchArtist;
  }) || null;
}

async function scoreAndResolveCandidates(candidates, profile, skipPatterns, guildId, context, resolutionOptions) {
  if (!candidates.length) return null;
  if (USE_SPOTIFY_METADATA) await enrichCandidatesWithSpotifyMetadata(candidates, candidates.length);

  const rankedCandidates = scoreCandidates(candidates, profile, skipPatterns, guildId);
  const { safe, deferred } = partitionRankedCandidates(rankedCandidates);
  const resolutionOrder = getDiversifiedResolutionOrder(rankedCandidates);
  const selectedCandidate = resolutionOrder[0];
  const selectedRank = rankedCandidates.indexOf(selectedCandidate) + 1;

  for (const candidate of deferred) {
    Log.info(
      "Autoplay deferred repeated artist",
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
    `winner=${rankedCandidates[0]?.artist} - ${rankedCandidates[0]?.title} (${rankedCandidates[0]?.score})`,
    `selected=${selectedCandidate?.artist} - ${selectedCandidate?.title} (${selectedCandidate?.score})`,
    `selectedRank=${selectedRank || "none"}`,
    `safe=${safe.length}`,
    `deferred=${deferred.length}`,
    `scoring=${rankedCandidates[0]?.scoringDetails?.join(", ") || "none"}`
  );
  Log.debug(
    "Runner-ups",
    "",
    `#2=${rankedCandidates[1]?.artist} - ${rankedCandidates[1]?.title} (${rankedCandidates[1]?.score})`,
    `#3=${rankedCandidates[2]?.artist} - ${rankedCandidates[2]?.title} (${rankedCandidates[2]?.score})`
  );

  return resolveRankedCandidates(resolutionOrder, guildId, context, resolutionOptions);
}

async function fetchSmartAutoplayTrack(referenceTrack, guildId) {
  if (!referenceTrack?.info) return null;

  const guildSettings = getGuildState(guildId);
  if (!guildSettings?.autoplay) return null;

  Log.info("Starting smart autoplay", "", `guild=${guildId}`, `reference=${referenceTrack.info.title}`);

  // Last.fm tags are the default genre anchor because the Spotify endpoints
  // needed for audio metadata are unavailable to most development-mode apps.
  let reference = getAutoplayReference(referenceTrack);
  let referenceTags = await getLastFmTrackTags({
    artist: reference.searchArtist,
    title: reference.cleanTitle,
    limit: 10,
  });
  if (!referenceTags.length) {
    const canonicalReference = await resolveCanonicalReference(reference.cleanTitle, reference.searchArtist, guildId);
    if (canonicalReference) {
      reference = canonicalReference;
      referenceTags = await getLastFmTrackTags({ artist: reference.searchArtist, title: reference.cleanTitle, limit: 10 });
    }
  }

  const referenceMetadata = {
    artist: reference.searchArtist,
    title: reference.cleanTitle,
    genres: referenceTrack.userData?.genres || [],
    features: referenceTrack.userData?.features || null,
  };
  if (referenceTags.length > 0) referenceMetadata.genres = referenceTags;
  if (USE_SPOTIFY_METADATA) await enrichCandidatesWithSpotifyMetadata([referenceMetadata], 1);
  referenceTrack.userData = {
    ...(referenceTrack.userData || {}),
    autoplayReference: { title: reference.cleanTitle, artist: reference.searchArtist },
    genres: referenceMetadata.genres,
    features: referenceMetadata.features,
    releaseYear: referenceMetadata.releaseYear,
  };
  if (referenceMetadata.genres?.length || referenceMetadata.features) {
    genreCache.set(referenceTrack.info.identifier, {
      genres: referenceMetadata.genres,
      features: referenceMetadata.features,
      releaseYear: referenceMetadata.releaseYear,
    });
  }

  const profile = buildSessionProfile(guildId, referenceTrack);
  profile.guildId = guildId;
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
    `timeOfDay=${timeOfDay.period}`
  );

  const skipPatterns = getSkipPatterns(guildId);

  const candidates = await collectCandidates(referenceTrack, guildId, profile, reference);

  Log.info("Candidates collected", "", `guild=${guildId}`, `total=${candidates.length}`);
  const playableTrack = await scoreAndResolveCandidates(candidates, profile, skipPatterns, guildId, "reference");
  if (playableTrack) return playableTrack;

  // Obscure uploads (especially meme music) can be absent from Last.fm and
  // audio-feature catalogs. In that fully metadata-free case, YouTube's own
  // Mix is the closest available radio signal. This stays before broad
  // fallbacks and never bypasses duplicate, variant, or artist-streak guards.
  const mixFallbackTrack = await resolveMetadataFreeYouTubeMixFallback(candidates, profile, skipPatterns, guildId);
  if (mixFallbackTrack) return mixFallbackTrack;

  const fallbackAnchor = getStableFallbackAnchor(profile, referenceTrack);
  if (fallbackAnchor) {
    const fallbackReference = getAutoplayReference(fallbackAnchor);
    Log.warning(
      "Autoplay retrying from stable session anchor",
      "",
      `guild=${guildId}`,
      `failedReference=${reference.searchArtist} - ${reference.cleanTitle}`,
      `anchor=${fallbackReference.searchArtist} - ${fallbackReference.cleanTitle}`
    );
    const fallbackCandidates = await collectCandidates(fallbackAnchor, guildId, profile, fallbackReference);
    const fallbackTrack = await scoreAndResolveCandidates(fallbackCandidates, profile, skipPatterns, guildId, "stable-anchor-fallback");
    if (fallbackTrack) return fallbackTrack;
  }

  // A same-artist third track may keep a room alive, but only after every
  // safe candidate from both the current and stable-anchor pools failed.
  const emergencyTrack = await scoreAndResolveCandidates(candidates, profile, skipPatterns, guildId, "artist-streak-emergency", {
    deferredOnly: true,
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
  getDiversifiedResolutionOrder,
  hasSessionVibeAnchor,
  getMetadataFreeYouTubeMixFallbackCandidates,
  resolveMetadataFreeYouTubeMixFallback,
  resolveRankedCandidates,
  getStableFallbackAnchor,
  enrichCandidatesWithLastFmTags,
  getRelevantPlayableTrack,
  resolveToPlayable,
  candidateKey,
  mergeCandidates,
};
