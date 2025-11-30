const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { scoreCandidates, getTimeOfDayFactor } = require("./candidateScoring");
const { getPoru } = require("./players");
const { buildSessionProfile, genreCache } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const { filterValidSongs } = require("./trackValidation");
const { getSpotifyBasedSuggestions } = require("./spotifyRecommendations");

// Minimum candidates needed before falling back to next source
const MIN_CANDIDATES_THRESHOLD = 5;

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

    const encodedQuery = encodeURIComponent(deezerSearchQuery);
    const lavalinkUrl = `http://localhost:2333/v4/loadtracks?identifier=${encodedQuery}`;
    const response = await fetch(lavalinkUrl, {
      headers: {
        Authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
      },
    });
    const deezerSearch = await response.json();

    // Convert Lavalink v4 response to Poru format
    if (deezerSearch.loadType === "search" || deezerSearch.loadType === "track") {
      deezerSearch.tracks = deezerSearch.data || [];
    }

    if (deezerSearch?.tracks?.length > 0) {
      const deezerTrack = deezerSearch.tracks[0];
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
        const encodedRecQuery = encodeURIComponent(deezerRecQuery);
        const lavalinkRecUrl = `http://localhost:2333/v4/loadtracks?identifier=${encodedRecQuery}`;
        const recResponse = await fetch(lavalinkRecUrl, {
          headers: {
            Authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
          },
        });
        const deezerRecs = await recResponse.json();

        // Convert Lavalink v4 response to Poru format
        if (deezerRecs.loadType === "search" || deezerRecs.loadType === "track") {
          deezerRecs.tracks = deezerRecs.data || [];
        } else if (deezerRecs.loadType === "playlist") {
          deezerRecs.tracks = deezerRecs.data?.tracks || [];
        }

        if (deezerRecs?.tracks?.length > 0) {
          const validTracks = filterValidSongs(deezerRecs.tracks).slice(0, 25);

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
async function fetchSpotifyCandidates(referenceTrack, guildId) {
  const candidates = [];

  try {
    Log.info("🎵 Fetching Spotify recommendations", "", `guild=${guildId}`);

    const spotifyRecs = await getSpotifyBasedSuggestions(referenceTrack);

    if (spotifyRecs && spotifyRecs.length > 0) {
      // Convert Spotify recommendations to playable tracks via Lavalink
      for (const rec of spotifyRecs) {
        try {
          // Use Spotify search via Lavalink (spsearch:)
          const spotifyQuery = `spsearch:${rec.artist} ${rec.title}`;
          const encodedQuery = encodeURIComponent(spotifyQuery);
          const lavalinkUrl = `http://localhost:2333/v4/loadtracks?identifier=${encodedQuery}`;
          const response = await fetch(lavalinkUrl, {
            headers: {
              Authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
            },
          });
          const searchResult = await response.json();

          // Convert Lavalink v4 response
          if (searchResult.loadType === "search" || searchResult.loadType === "track") {
            searchResult.tracks = searchResult.data || [];
          }

          if (searchResult?.tracks?.length > 0) {
            const track = searchResult.tracks[0];
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
 * Collects candidate tracks from multiple sources with prioritization
 * Priority order: Deezer → Spotify → YouTube Mix → YouTube Search → Top Artist
 * Only falls back to next source if current source provides insufficient candidates
 *
 * @param {Object} referenceTrack - Reference track to base candidates on
 * @param {string} guildId - Guild identifier
 * @param {Object} profile - Session profile from buildSessionProfile
 * @returns {Promise<Array>} Array of candidate tracks
 */
async function collectCandidates(referenceTrack, guildId, profile) {
  const { title, author, identifier } = referenceTrack.info;
  const { cleanTitle, searchArtist } = cleanTrackInfo(title, author);

  let allCandidates = [];

  // Priority 1: Deezer recommendations (best quality, platform-native)
  const deezerCandidates = await fetchDeezerCandidates(guildId, cleanTitle, searchArtist);
  allCandidates.push(...deezerCandidates);

  Log.info(
    "📊 After Deezer",
    "",
    `guild=${guildId}`,
    `deezerCount=${deezerCandidates.length}`,
    `total=${allCandidates.length}`
  );

  // Priority 2: Spotify recommendations (has rich metadata like genres, popularity)
  // Always fetch Spotify for metadata even if Deezer has enough candidates
  const spotifyCandidates = await fetchSpotifyCandidates(referenceTrack, guildId);
  allCandidates.push(...spotifyCandidates);

  Log.info(
    "📊 After Spotify",
    "",
    `guild=${guildId}`,
    `spotifyCount=${spotifyCandidates.length}`,
    `total=${allCandidates.length}`
  );

  // Priority 3: YouTube Mix (only if we don't have enough candidates yet)
  if (allCandidates.length < MIN_CANDIDATES_THRESHOLD) {
    const youtubeMixCandidates = await fetchYouTubeMixCandidates(identifier, guildId);
    allCandidates.push(...youtubeMixCandidates);

    Log.info(
      "📊 After YouTube Mix",
      "",
      `guild=${guildId}`,
      `mixCount=${youtubeMixCandidates.length}`,
      `total=${allCandidates.length}`
    );
  }

  // Priority 4: YouTube search (only if still not enough)
  if (allCandidates.length < MIN_CANDIDATES_THRESHOLD) {
    const youtubeSearchCandidates = await fetchYouTubeSearchCandidates(cleanTitle, searchArtist, guildId);
    allCandidates.push(...youtubeSearchCandidates);

    Log.info(
      "📊 After YouTube Search",
      "",
      `guild=${guildId}`,
      `searchCount=${youtubeSearchCandidates.length}`,
      `total=${allCandidates.length}`
    );
  }

  // Priority 5: Top artist search (absolute last resort)
  if (allCandidates.length === 0 && profile.topArtists.length > 0) {
    const topArtistCandidates = await fetchTopArtistCandidates(profile, guildId);
    allCandidates.push(...topArtistCandidates);

    Log.info(
      "📊 After Top Artist",
      "",
      `guild=${guildId}`,
      `topArtistCount=${topArtistCandidates.length}`,
      `total=${allCandidates.length}`
    );
  }

  // Log source distribution
  const sourceBreakdown = {};
  allCandidates.forEach((c) => {
    sourceBreakdown[c.source] = (sourceBreakdown[c.source] || 0) + 1;
  });

  Log.info(
    "📊 Candidate collection complete",
    "",
    `guild=${guildId}`,
    `total=${allCandidates.length}`,
    `breakdown=${Object.entries(sourceBreakdown)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")}`
  );

  return allCandidates;
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
      const track = validTracks[0];

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

  for (let i = 0; i < Math.min(5, rankedCandidates.length); i++) {
    const candidate = rankedCandidates[i];

    if (candidate.score < 10) {
      Log.warning("Top candidate score too low, giving up", "", `guild=${guildId}`, `score=${candidate.score}`);
      break;
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
