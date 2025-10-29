const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { scoreCandidates, getTimeOfDayFactor } = require("./candidateScoring");
const { getPoru } = require("./players");
const { buildSessionProfile, genreCache } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const { filterValidSongs } = require("./trackValidation");

/**
 * Collects candidate tracks from multiple sources
 * @param {Object} referenceTrack - Reference track to base candidates on
 * @param {string} guildId - Guild identifier
 * @param {Object} profile - Session profile from buildSessionProfile
 * @returns {Promise<Array>} Array of candidate tracks
 */
async function collectCandidates(referenceTrack, guildId, profile) {
  const poru = getPoru();
  const candidates = [];
  const { title, author, identifier } = referenceTrack.info;

  // Source 1: Deezer recommendations (primary source)
  try {
    // Clean up title - extract actual artist and title from YouTube naming conventions
    let cleanTitle = title;
    let searchArtist = author;

    // Check if title contains " - " which usually separates artist from title
    if (title.includes(" - ")) {
      const parts = title.split(" - ");
      // If first part looks like artist name, use it
      if (parts.length >= 2) {
        searchArtist = parts[0].trim();
        cleanTitle = parts.slice(1).join(" - ").trim();
      }
    }

    // Remove common YouTube suffixes
    cleanTitle = cleanTitle
      .replace(/\(official\s*(video|audio|music\s*video)?\)/gi, "")
      .replace(/\[official\s*(video|audio|music\s*video)?\]/gi, "")
      .replace(/\s*-?\s*(official|lyric|lyrics|video|audio|hq|hd)\s*$/gi, "")
      .trim();

    // Search for track on Deezer
    const deezerSearchQuery = `dzsearch:${searchArtist} ${cleanTitle}`;
    Log.info("Searching Deezer", "", `guild=${guildId}`, `query=${deezerSearchQuery}`);

    // Use direct Lavalink REST API instead of Poru (workaround for dzsearch: prefix issue)
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

    Log.info(
      "Deezer search response",
      "",
      `guild=${guildId}`,
      `loadType=${deezerSearch?.loadType}`,
      `trackCount=${deezerSearch?.tracks?.length || 0}`,
      `firstTrackSource=${deezerSearch?.tracks?.[0]?.info?.sourceName || "none"}`
    );

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
          Log.info("Extracted Deezer ID from URI", "", `guild=${guildId}`, `deezerID=${deezerTrackId}`);
        }
      }

      Log.info(
        "Found track on Deezer",
        "",
        `guild=${guildId}`,
        `track=${deezerTrack.info?.title}`,
        `deezerID=${deezerTrackId}`,
        `sourceName=${sourceName}`,
        `uri=${uri}`
      );

      // Only proceed if we have numeric Deezer ID
      if (deezerTrackId && /^\d+$/.test(deezerTrackId)) {
        // Get recommendations from Deezer using direct REST API
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

        Log.info(
          "Deezer recommendations response",
          "",
          `guild=${guildId}`,
          `loadType=${deezerRecs?.loadType}`,
          `trackCount=${deezerRecs?.tracks?.length || 0}`
        );

        if (deezerRecs?.tracks?.length > 0) {
          const validTracks = filterValidSongs(deezerRecs.tracks).slice(0, 20);

          // Add Deezer tracks directly without Spotify enrichment for speed
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
            "Collected Deezer recommendations",
            "",
            `guild=${guildId}`,
            `count=${validTracks.length}`,
            `referenceTrack=${author} - ${title}`
          );
        } else {
          Log.warning("No Deezer recommendations found", "", `guild=${guildId}`, `deezerID=${deezerTrackId}`);
        }
      } else {
        Log.warning("No Deezer track ID", "", `guild=${guildId}`);
      }
    } else {
      Log.warning("Track not found on Deezer", "", `guild=${guildId}`, `query=${deezerSearchQuery}`);
    }
  } catch (err) {
    Log.warning("Failed to get Deezer recommendations", err.message, `guild=${guildId}`);
  }

  // Source 2: YouTube Mix Radio (fallback)
  try {
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

      Log.info("Collected YouTube Mix candidates", "", `guild=${guildId}`, `count=${validTracks.length}`);
    }
  } catch (err) {
    Log.warning("Failed to get YouTube Mix", err.message, `guild=${guildId}`);
  }

  // Source 3: Generic YouTube search fallback (when Mix fails)
  if (candidates.length === 0) {
    try {
      Log.info("Trying generic YouTube search fallback", "", `guild=${guildId}`, `query=${author} ${title}`);
      const searchQuery = `ytsearch:${author} ${title}`;
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

        Log.info("Collected YouTube search candidates", "", `guild=${guildId}`, `count=${validTracks.length}`);
      }
    } catch (err) {
      Log.warning("Failed YouTube search fallback", err.message, `guild=${guildId}`);
    }
  }

  // Source 4: Top artist search (last resort)
  if (profile.topArtists.length > 0 && profile.topGenres.length > 0) {
    const topArtist = profile.topArtists[0].artist;

    try {
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

      Log.info(
        "Collected top artist candidates",
        "",
        `guild=${guildId}`,
        `artist=${topArtist}`,
        `count=${validTracks.length}`
      );
    } catch (err) {
      Log.warning("Failed to search top artist", err.message);
    }
  }

  return candidates;
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
