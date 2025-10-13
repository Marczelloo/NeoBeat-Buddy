const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { getPoru } = require("./players");
const {
  searchSpotifyTrack,
  getSpotifyRecommendations,
  getTrackDetails,
  getArtistGenres,
} = require("./spotifyRecommendations");
const { playbackState } = require("./state");
const { filterValidSongs } = require("./trackValidation");

const skipHistory = new Map();
const genreCache = new Map(); // Cache genre information for tracks
const sessionStartTime = new Map(); // Track when autoplay session started

function buildSessionProfile(guildId, referenceTrack) {
  const state = playbackState.get(guildId);
  const history = state?.history || [];

  Log.debug(
    "Building session profile",
    "",
    `guild=${guildId}`,
    `historyLength=${history.length}`,
    `referenceTrack=${referenceTrack?.info?.title || "none"}`,
    `historyTracks=${history
      .slice(-5)
      .map((t) => t.info?.title || "unknown")
      .join(" → ")}`
  );

  const recentTracks = [...history.slice(-14), referenceTrack].filter(Boolean);

  if (recentTracks.length === 0) {
    return {
      topArtists: [],
      artistCounts: {},
      avgDuration: 0,
      totalTracks: 0,
      recentIdentifiers: [],
      topGenres: [],
      genreCounts: {},
      avgFeatures: null,
      avgTempo: null,
      avgYear: null,
      energyTrend: null,
      valenceTrend: null,
    };
  }

  const artistCounts = {};
  const genreCounts = {};
  let totalDuration = 0;
  const identifiers = [];
  const featuresList = [];
  const tempos = [];
  const years = [];
  const energyValues = [];
  const valenceValues = [];

  recentTracks.forEach((track) => {
    const artist = track.info?.author || "Unknown";
    const duration = track.info?.length || 0;
    const id = track.info?.identifier;

    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    totalDuration += duration;
    if (id) identifiers.push(id);

    // Aggregate genre information from cached data
    const cachedData = track.userData?.genres ? track.userData : genreCache.get(id);
    const cachedGenres = cachedData?.genres || [];
    const cachedFeatures = cachedData?.features;
    const cachedYear = cachedData?.releaseYear;

    cachedGenres.forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });

    // Aggregate audio features if available
    if (cachedFeatures) {
      featuresList.push(cachedFeatures);
      energyValues.push(cachedFeatures.energy);
      valenceValues.push(cachedFeatures.valence);
      if (cachedFeatures.tempo) {
        tempos.push(cachedFeatures.tempo);
      }
    }

    // Collect years
    if (cachedYear) {
      years.push(cachedYear);
    }
  });

  const topArtists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count, weight: count / recentTracks.length }));

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count, weight: count / recentTracks.length }));

  const avgDuration = totalDuration / recentTracks.length;

  // Calculate average audio features
  let avgFeatures = null;
  if (featuresList.length > 0) {
    avgFeatures = {
      energy: featuresList.reduce((sum, f) => sum + (f.energy || 0), 0) / featuresList.length,
      danceability: featuresList.reduce((sum, f) => sum + (f.danceability || 0), 0) / featuresList.length,
      valence: featuresList.reduce((sum, f) => sum + (f.valence || 0), 0) / featuresList.length,
      acousticness: featuresList.reduce((sum, f) => sum + (f.acousticness || 0), 0) / featuresList.length,
      tempo: tempos.length > 0 ? tempos.reduce((sum, t) => sum + t, 0) / tempos.length : null,
    };
  }

  // Calculate average tempo
  const avgTempo = tempos.length > 0 ? tempos.reduce((sum, t) => sum + t, 0) / tempos.length : null;

  // Calculate average release year
  const avgYear = years.length > 0 ? Math.round(years.reduce((sum, y) => sum + y, 0) / years.length) : null;

  // Detect energy trend (last 5 tracks)
  let energyTrend = null;
  if (energyValues.length >= 3) {
    const recent = energyValues.slice(-5);
    const first =
      recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recent.length / 2);
    const last = recent.slice(Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(recent.length / 2);
    const diff = last - first;

    if (diff > 0.1) energyTrend = "increasing";
    else if (diff < -0.1) energyTrend = "decreasing";
    else energyTrend = "stable";
  }

  // Detect valence (mood) trend
  let valenceTrend = null;
  if (valenceValues.length >= 3) {
    const recent = valenceValues.slice(-5);
    const first =
      recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recent.length / 2);
    const last = recent.slice(Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(recent.length / 2);
    const diff = last - first;

    if (diff > 0.1) valenceTrend = "increasing";
    else if (diff < -0.1) valenceTrend = "decreasing";
    else valenceTrend = "stable";
  }

  Log.debug(
    "Session profile with enhanced features",
    "",
    `guild=${guildId}`,
    `topGenres=${topGenres
      .slice(0, 3)
      .map((g) => `${g.genre}(${g.count})`)
      .join(", ")}`,
    `avgTempo=${avgTempo ? Math.round(avgTempo) : "unknown"}`,
    `avgYear=${avgYear || "unknown"}`,
    `energyTrend=${energyTrend || "unknown"}`,
    `valenceTrend=${valenceTrend || "unknown"}`
  );

  return {
    topArtists,
    artistCounts,
    avgDuration,
    totalTracks: recentTracks.length,
    recentIdentifiers: identifiers.slice(-20),
    topGenres,
    genreCounts,
    avgFeatures,
    avgTempo,
    avgYear,
    energyTrend,
    valenceTrend,
  };
}

function getSkipPatterns(guildId) {
  const skips = skipHistory.get(guildId) || [];
  const recentSkips = skips.filter((s) => Date.now() - s.timestamp < 30 * 60 * 1000);

  const skippedArtists = {};
  const skippedGenres = {};

  recentSkips.forEach((skip) => {
    if (skip.artist) {
      skippedArtists[skip.artist] = (skippedArtists[skip.artist] || 0) + 1;
    }
    if (skip.genres) {
      skip.genres.forEach((genre) => {
        skippedGenres[genre] = (skippedGenres[genre] || 0) + 1;
      });
    }
  });

  return {
    recentSkips,
    skippedArtists,
    skippedGenres,
    totalSkips: recentSkips.length,
  };
}

function recordSkip(guildId, track, reason = "manual") {
  if (!skipHistory.has(guildId)) {
    skipHistory.set(guildId, []);
  }

  const skips = skipHistory.get(guildId);
  const genres = track.userData?.genres || genreCache.get(track.info?.identifier)?.genres || [];

  skips.push({
    artist: track.info?.author,
    title: track.info?.title,
    genres,
    timestamp: Date.now(),
    reason,
  });

  if (skips.length > 50) {
    skips.splice(0, skips.length - 50);
  }

  Log.info(
    "Skip recorded for learning",
    "",
    `guild=${guildId}`,
    `artist=${track.info?.author}`,
    `genres=${genres.join(", ")}`,
    `reason=${reason}`
  );
}

/**
 * Get time-of-day factor for energy preferences
 */
function getTimeOfDayFactor() {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) return { period: "morning", energyPreference: "moderate", factor: 0.6 };
  if (hour >= 12 && hour < 18) return { period: "afternoon", energyPreference: "high", factor: 0.75 };
  if (hour >= 18 && hour < 22) return { period: "evening", energyPreference: "moderate", factor: 0.65 };
  return { period: "night", energyPreference: "low", factor: 0.4 };
}

async function collectCandidates(referenceTrack, guildId, profile) {
  const poru = getPoru();
  const candidates = [];
  const { title, author, identifier } = referenceTrack.info;

  // Try to get genre information for reference track
  let referenceGenres = [];
  let referenceFeatures = null;
  let referenceYear = null;

  try {
    const trackId = await searchSpotifyTrack(title, author);
    if (trackId) {
      // Get detailed track info including genres and features
      const trackDetails = await getTrackDetails(trackId);

      if (trackDetails) {
        // Get genres from artists
        if (trackDetails.artistIds.length > 0) {
          referenceGenres = await getArtistGenres(trackDetails.artistIds);
          referenceFeatures = trackDetails.features;
          referenceYear = trackDetails.releaseYear;

          // Cache this information
          genreCache.set(identifier, {
            genres: referenceGenres,
            features: referenceFeatures,
            releaseYear: referenceYear,
          });

          Log.info(
            "Reference track details found",
            "",
            `guild=${guildId}`,
            `genres=${referenceGenres.join(", ")}`,
            `tempo=${referenceFeatures?.tempo ? Math.round(referenceFeatures.tempo) : "unknown"}`,
            `year=${referenceYear || "unknown"}`
          );
        }
      }

      // Use genre-aware recommendations with enhanced targeting
      const targetGenres = referenceGenres.length > 0 ? referenceGenres : profile.topGenres.map((g) => g.genre);
      const targetFeatures = referenceFeatures || profile.avgFeatures;

      const spotifyRecs = await getSpotifyRecommendations(trackId, 15, targetGenres.slice(0, 2), targetFeatures);

      for (const rec of spotifyRecs) {
        candidates.push({
          artist: rec.artist,
          title: rec.title,
          source: "spotify",
          genres: rec.genres || [],
          spotifyId: rec.spotifyId,
          popularity: rec.popularity || 0,
          releaseYear: rec.releaseYear,
          features: rec.features,
          score: 0,
        });
      }

      Log.info(
        "Collected genre-aware Spotify candidates",
        "",
        `guild=${guildId}`,
        `count=${spotifyRecs.length}`,
        `targetGenres=${targetGenres.slice(0, 2).join(", ")}`
      );
    }
  } catch (err) {
    Log.warning("Failed to get Spotify recommendations", err.message);
  }

  // YouTube Mix as fallback/supplement
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
          genres: [], // YouTube doesn't provide genre info
          popularity: 0,
          releaseYear: null,
          features: null,
          score: 0,
        });
      });

      Log.info("Collected YouTube Mix candidates", "", `guild=${guildId}`, `count=${validTracks.length}`);
    }
  } catch (err) {
    Log.warning("Failed to get YouTube Mix", err.message);
  }

  // Top artist search (only if we have strong genre profile)
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
          genres: [], // Will inherit from artist if matched
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

function scoreCandidates(candidates, profile, skipPatterns, guildId) {
  const timeOfDay = getTimeOfDayFactor();

  // Track if session is starting (no start time yet)
  if (!sessionStartTime.has(guildId)) {
    sessionStartTime.set(guildId, Date.now());
  }

  candidates.forEach((candidate) => {
    let score = 50;
    const scoringDetails = [];

    // 1. Artist familiarity scoring
    const artistWeight = profile.artistCounts[candidate.artist] || 0;
    const artistScore = artistWeight * 5;
    score += artistScore;
    if (artistScore > 0) scoringDetails.push(`artist:+${artistScore}`);

    // 2. Duration similarity
    if (candidate.duration && profile.avgDuration) {
      const durationDiff = Math.abs(candidate.duration - profile.avgDuration);
      const durationRatio = durationDiff / profile.avgDuration;

      if (durationRatio < 0.2) {
        score += 10;
        scoringDetails.push("duration:+10");
      } else if (durationRatio < 0.4) {
        score += 5;
        scoringDetails.push("duration:+5");
      } else {
        score -= 5;
        scoringDetails.push("duration:-5");
      }
    }

    // 3. Source quality preference
    if (candidate.source === "spotify") {
      score += 30;
      scoringDetails.push("source:+30");
    } else if (candidate.source === "youtube_mix") {
      score += 15;
      scoringDetails.push("source:+15");
    } else if (candidate.source === "top_artist_search") {
      score += 10;
      scoringDetails.push("source:+10");
    }

    // 4. GENRE CONSISTENCY SCORING
    if (candidate.genres && candidate.genres.length > 0 && profile.topGenres.length > 0) {
      let genreMatchScore = 0;

      candidate.genres.forEach((candidateGenre) => {
        const genreProfile = profile.topGenres.find((g) => g.genre === candidateGenre);

        if (genreProfile) {
          genreMatchScore += 30 * genreProfile.weight;
        } else {
          const partialMatch = profile.topGenres.find((g) => {
            return candidateGenre.includes(g.genre) || g.genre.includes(candidateGenre);
          });

          if (partialMatch) {
            genreMatchScore += 15 * partialMatch.weight;
          }
        }
      });

      score += genreMatchScore;
      if (genreMatchScore > 0) scoringDetails.push(`genre:+${Math.floor(genreMatchScore)}`);

      if (genreMatchScore === 0 && profile.topGenres.length >= 3) {
        score -= 25;
        scoringDetails.push("genreDrift:-25");
      }
    } else if (profile.topGenres.length >= 3) {
      score -= 10;
      scoringDetails.push("noGenre:-10");
    }

    // 5. NEW: TEMPO/BPM CONSISTENCY
    if (candidate.features?.tempo && profile.avgTempo) {
      const tempoDiff = Math.abs(candidate.features.tempo - profile.avgTempo);

      if (tempoDiff < 15) {
        score += 15;
        scoringDetails.push("tempo:+15");
      } else if (tempoDiff < 30) {
        score += 8;
        scoringDetails.push("tempo:+8");
      } else if (tempoDiff > 60) {
        score -= 5;
        scoringDetails.push("tempo:-5");
      }
    }

    // 6. NEW: TIME-OF-DAY ENERGY AWARENESS
    if (candidate.features?.energy !== undefined) {
      const energyDiff = Math.abs(candidate.features.energy - timeOfDay.factor);

      if (energyDiff < 0.15) {
        score += 12;
        scoringDetails.push(`timeOfDay:+12(${timeOfDay.period})`);
      } else if (energyDiff < 0.3) {
        score += 6;
        scoringDetails.push(`timeOfDay:+6(${timeOfDay.period})`);
      }
    }

    // 7. NEW: POPULARITY WEIGHTING (balanced discovery)
    if (candidate.popularity > 0) {
      if (candidate.popularity >= 50 && candidate.popularity <= 85) {
        score += 10;
        scoringDetails.push("popularity:+10");
      } else if (candidate.popularity < 25) {
        score -= 5;
        scoringDetails.push("popularity:-5(obscure)");
      } else if (candidate.popularity > 95) {
        score -= 3;
        scoringDetails.push("popularity:-3(overplayed)");
      }
    }

    // 8. NEW: MOOD PROGRESSION (valence trend)
    if (candidate.features?.valence !== undefined && profile.valenceTrend && profile.avgFeatures?.valence) {
      if (profile.valenceTrend === "increasing" && candidate.features.valence > profile.avgFeatures.valence) {
        score += 12;
        scoringDetails.push("mood:+12(rising)");
      } else if (profile.valenceTrend === "decreasing" && candidate.features.valence < profile.avgFeatures.valence) {
        score += 12;
        scoringDetails.push("mood:+12(falling)");
      } else if (profile.valenceTrend === "stable") {
        const valenceDiff = Math.abs(candidate.features.valence - profile.avgFeatures.valence);
        if (valenceDiff < 0.15) {
          score += 8;
          scoringDetails.push("mood:+8(stable)");
        }
      }
    }

    // 9. NEW: ENERGY ARC MANAGEMENT
    if (candidate.features?.energy !== undefined && profile.energyTrend && profile.avgFeatures?.energy) {
      if (profile.energyTrend === "increasing" && candidate.features.energy > profile.avgFeatures.energy) {
        score += 15;
        scoringDetails.push("energyArc:+15(building)");
      } else if (profile.energyTrend === "decreasing" && candidate.features.energy < profile.avgFeatures.energy) {
        score += 15;
        scoringDetails.push("energyArc:+15(winding)");
      } else if (profile.energyTrend === "stable") {
        const energyDiff = Math.abs(candidate.features.energy - profile.avgFeatures.energy);
        if (energyDiff < 0.15) {
          score += 10;
          scoringDetails.push("energyArc:+10(plateau)");
        }
      }
    }

    // 10. Artist diversity bonus (prevent clustering)
    const isRecentArtist = profile.topArtists.slice(0, 3).some((a) => a.artist === candidate.artist);
    if (!isRecentArtist) {
      score += 20;
      scoringDetails.push("diversity:+20");
    } else {
      score -= 10;
      scoringDetails.push("diversity:-10");
    }

    // 11. Skip learning penalties
    const skipCount = skipPatterns.skippedArtists[candidate.artist] || 0;
    if (skipCount > 0) {
      const skipPenalty = skipCount * 20;
      score -= skipPenalty;
      scoringDetails.push(`skipArtist:-${skipPenalty}`);
    }

    // 12. Genre skip penalties
    if (candidate.genres && candidate.genres.length > 0) {
      candidate.genres.forEach((genre) => {
        const genreSkipCount = skipPatterns.skippedGenres[genre] || 0;
        if (genreSkipCount > 0) {
          const genreSkipPenalty = genreSkipCount * 15;
          score -= genreSkipPenalty;
          scoringDetails.push(`skipGenre:-${genreSkipPenalty}`);
        }
      });
    }

    // 13. Duplicate detection
    const isDuplicate = profile.recentIdentifiers.includes(candidate.identifier);
    if (isDuplicate) {
      score -= 1000;
      scoringDetails.push("duplicate:-1000");
    }

    candidate.score = Math.max(0, score);
    candidate.scoringDetails = scoringDetails;
  });

  candidates.sort((a, b) => b.score - a.score);

  // Add variety to top candidates (reduced from 15 to 10 to prefer consistency)
  const topScore = candidates.length > 0 ? candidates[0].score : 0;
  const topCandidates = candidates.filter((c) => c.score >= topScore - 10 && c.score > 0);

  if (topCandidates.length > 1) {
    topCandidates.forEach((c) => {
      c.score += Math.random() * 5;
    });

    candidates.sort((a, b) => b.score - a.score);

    Log.debug(
      "Added variety to top candidates",
      "",
      `topCount=${topCandidates.length}`,
      `selected=${candidates[0]?.title || "none"}`,
      `genres=${candidates[0]?.genres?.join(", ") || "unknown"}`
    );
  }

  return candidates;
}

async function resolveToPlayable(candidate, guildId) {
  if (candidate.track) {
    // Attach metadata to track userData for future use
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

      // Attach metadata to track
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

      // Cache metadata
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

  // Log top 3 with detailed scoring
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
  recordSkip,
  buildSessionProfile,
};
