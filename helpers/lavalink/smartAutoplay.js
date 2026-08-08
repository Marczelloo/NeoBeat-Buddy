const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { scoreCandidates, getTimeOfDayFactor } = require("./candidateScoring");
const { getLastFmSimilarTracks, getLastFmTrackTags } = require("./lastfmClient");
const { getPoru } = require("./players");
const { filterRelevantSearchResults, rankSearchResults } = require("./searchRanking");
const { buildSessionProfile, genreCache } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const {
  getSpotifyBasedSuggestions,
  enrichCandidatesWithSpotifyMetadata,
} = require("./spotifyRecommendations");
const { filterValidSongs } = require("./trackValidation");

const USE_SPOTIFY_AUTOPLAY = process.env.USE_SPOTIFY_AUTOPLAY === "true";
const USE_SPOTIFY_METADATA = process.env.USE_SPOTIFY_METADATA === "true";
const ALTERNATE_VERSION_PATTERN = /\b(?:remix|live|nightcore|slowed|sped\s*up|speed\s*up|cover|karaoke|instrumental)\b/i;

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
  const identifier = candidate?.identifier || candidate?.track?.info?.identifier;
  if (identifier) return `id:${identifier}`;

  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `text:${normalize(candidate?.artist)}:${normalize(candidate?.title)}`;
}

function mergeCandidates(candidates) {
  const merged = new Map();

  for (const candidate of candidates) {
    if (!candidate?.title || !candidate?.artist) continue;

    const key = candidateKey(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...candidate, genres: [...(candidate.genres || [])] });
      continue;
    }

    existing.genres = [...new Set([...(existing.genres || []), ...(candidate.genres || [])])];
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
  const relevant = filterRelevantSearchResults(filterValidSongs(tracks || []), query);
  const queryRequestsAlternateVersion = ALTERNATE_VERSION_PATTERN.test(query);
  const originalOnly = queryRequestsAlternateVersion
    ? relevant
    : relevant.filter((track) => !ALTERNATE_VERSION_PATTERN.test(track.info?.title || ""));
  return rankSearchResults(originalOnly, query)[0] || null;
}

/**
 * Cleans up title for better search results
 * @param {string} title - Raw track title
 * @param {string} author - Raw track author
 * @returns {Object} Cleaned title and artist
 */
function cleanTrackInfo(title, author) {
  let cleanTitle = title;
  let searchArtist = author;

  // Check if title contains " - " which usually separates artist from title
  if (title.includes(" - ")) {
    const parts = title.split(" - ");
    if (parts.length >= 2) {
      searchArtist = parts[0].trim();
      cleanTitle = parts.slice(1).join(" - ").trim();
    }
  }

  // Remove common YouTube suffixes
  cleanTitle = cleanTitle
    .replace(/\(official\s*(video|audio|music\s*video|mv|lyric\s*video)?\)/gi, "")
    .replace(/\[official\s*(video|audio|music\s*video|mv|lyric\s*video)?\]/gi, "")
    .replace(/\s*-?\s*(official|lyric|lyrics|video|audio|hq|hd|4k|8k|visualizer)\s*$/gi, "")
    .replace(/\s*\|\s*.*$/gi, "") // Remove " | Something" suffixes
    .trim();

  return { cleanTitle, searchArtist };
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

async function fetchLastFmCandidates(referenceTrack, guildId) {
  const candidates = [];

  try {
    const similarTracks = await getLastFmSimilarTracks({
      artist: referenceTrack.info?.author,
      title: referenceTrack.info?.title,
      limit: 12,
    });

    const maximumMatch = Math.max(...similarTracks.map((track) => Number(track.match) || 0), 0);

    // Tags add useful genre evidence but Last.fm is a shared service. Eight
    // strong neighbours with a small worker pool are enough for a queue slot
    // and keep the request pattern respectful under multiple guilds.
    const resolved = await mapWithConcurrency(similarTracks.slice(0, 8), 2, async (similar) => {
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
async function collectCandidates(referenceTrack, guildId, profile) {
  const { title, author, identifier } = referenceTrack.info;
  const { cleanTitle, searchArtist } = cleanTrackInfo(title, author);

  // Only sources that provide an actual related/radio set may drive autoplay.
  // Broad artist searches were the source of most "fallback picked something
  // completely different" incidents, so they are intentionally not used here.
  const candidateSources = [
    ["deezer", () => fetchDeezerCandidates(guildId, cleanTitle, searchArtist)],
    ["lastfm", () => fetchLastFmCandidates(referenceTrack, guildId)],
    ["youtubeMix", () => fetchYouTubeMixCandidates(identifier, guildId)],
  ];
  if (USE_SPOTIFY_AUTOPLAY) {
    candidateSources.push(["spotify", () => fetchSpotifyCandidates(referenceTrack, guildId, profile)]);
  }

  const sourceResults = await Promise.allSettled(candidateSources.map(([, load]) => load()));
  const allCandidates = sourceResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const deduplicatedCandidates = mergeCandidates(allCandidates);

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
  if (candidate.track) {
    candidate.track.userData = candidate.track.userData || {};
    if (candidate.genres && candidate.genres.length > 0) {
      candidate.track.userData.genres = candidate.genres;
    }
    if (candidate.features) {
      candidate.track.userData.features = candidate.features;
    }
    if (candidate.releaseYear) {
      candidate.track.userData.releaseYear = candidate.releaseYear;
    }
    return candidate.track;
  }

  const poru = getPoru();
  const searchQuery = `${candidate.artist} ${candidate.title}`;

  try {
    const searchRes = await poru.resolve({ query: `ytsearch:${searchQuery}` });
    const validTracks = filterValidSongs(searchRes.tracks || []);

    if (validTracks.length > 0) {
      const track = rankSearchResults(validTracks, searchQuery)[0];

      track.userData = track.userData || {};
      if (candidate.genres && candidate.genres.length > 0) {
        track.userData.genres = candidate.genres;
      }
      if (candidate.features) {
        track.userData.features = candidate.features;
      }
      if (candidate.releaseYear) {
        track.userData.releaseYear = candidate.releaseYear;
      }

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
        `query=${searchQuery}`,
        `genres=${candidate.genres?.join(", ") || "unknown"}`
      );

      return track;
    }
  } catch (err) {
    Log.error("Failed to resolve candidate", err, `guild=${guildId}`, `query=${searchQuery}`);
  }

  return null;
}

async function fetchSmartAutoplayTrack(referenceTrack, guildId) {
  if (!referenceTrack?.info) return null;

  const guildSettings = getGuildState(guildId);
  if (!guildSettings?.autoplay) return null;

  Log.info("Starting smart autoplay", "", `guild=${guildId}`, `reference=${referenceTrack.info.title}`);

  // Last.fm tags are the default genre anchor because the Spotify endpoints
  // needed for audio metadata are unavailable to most development-mode apps.
  const referenceMetadata = {
    artist: referenceTrack.info.author,
    title: referenceTrack.info.title,
    genres: referenceTrack.userData?.genres || [],
    features: referenceTrack.userData?.features || null,
  };
  const lastFmTags = await getLastFmTrackTags({
    artist: referenceTrack.info.author,
    title: referenceTrack.info.title,
    limit: 10,
  });
  if (lastFmTags.length > 0) referenceMetadata.genres = lastFmTags;
  if (USE_SPOTIFY_METADATA) await enrichCandidatesWithSpotifyMetadata([referenceMetadata], 1);
  if (referenceMetadata.genres?.length || referenceMetadata.features) {
    referenceTrack.userData = {
      ...(referenceTrack.userData || {}),
      genres: referenceMetadata.genres,
      features: referenceMetadata.features,
      releaseYear: referenceMetadata.releaseYear,
    };
    genreCache.set(referenceTrack.info.identifier, {
      genres: referenceMetadata.genres,
      features: referenceMetadata.features,
      releaseYear: referenceMetadata.releaseYear,
    });
  }

  const profile = buildSessionProfile(guildId, referenceTrack);
  profile.guildId = guildId;

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

  const candidates = await collectCandidates(referenceTrack, guildId, profile);

  if (candidates.length === 0) {
    Log.warning("No candidates found for smart autoplay", "", `guild=${guildId}`);
    return null;
  }

  Log.info("Candidates collected", "", `guild=${guildId}`, `total=${candidates.length}`);

  if (USE_SPOTIFY_METADATA) await enrichCandidatesWithSpotifyMetadata(candidates, candidates.length);

  const rankedCandidates = scoreCandidates(candidates, profile, skipPatterns, guildId);

  Log.info(
    "Top candidates scored",
    "",
    `guild=${guildId}`,
    `winner=${rankedCandidates[0]?.artist} - ${rankedCandidates[0]?.title} (${rankedCandidates[0]?.score})`,
    `scoring=${rankedCandidates[0]?.scoringDetails?.join(", ") || "none"}`
  );

  Log.debug(
    "Runner-ups",
    "",
    `#2=${rankedCandidates[1]?.artist} - ${rankedCandidates[1]?.title} (${rankedCandidates[1]?.score})`,
    `#3=${rankedCandidates[2]?.artist} - ${rankedCandidates[2]?.title} (${rankedCandidates[2]?.score})`
  );

  for (const candidate of rankedCandidates) {

    if (candidate.hardRejected) {
      Log.debug(
        "Skipping hard-rejected autoplay candidate",
        "",
        `guild=${guildId}`,
        `track=${candidate.artist} - ${candidate.title}`,
        `reason=${candidate.rejectionReason || "incompatible vibe"}`
      );
      continue;
    }

    if (candidate.score < 10) {
      continue;
    }

    const playableTrack = await resolveToPlayable(candidate, guildId);

    if (playableTrack) {
      Log.info(
        "Smart autoplay track selected",
        "",
        `guild=${guildId}`,
        `track=${playableTrack.info?.title}`,
        `artist=${playableTrack.info?.author}`,
        `genres=${candidate.genres?.join(", ") || "unknown"}`,
        `tempo=${candidate.features?.tempo ? Math.round(candidate.features.tempo) : "unknown"}BPM`,
        `energy=${candidate.features?.energy ? candidate.features.energy.toFixed(2) : "unknown"}`,
        `score=${candidate.score}`,
        `source=${candidate.source}`
      );

      return playableTrack;
    }
  }

  Log.warning("Failed to resolve any candidate to playable track", "", `guild=${guildId}`);
  return null;
}

module.exports = {
  fetchSmartAutoplayTrack,
};
