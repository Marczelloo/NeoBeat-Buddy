const Log = require("../logs/log");
const { sessionStartTime } = require("./sessionProfile");

/**
 * Gets time-of-day factor for energy preferences
 * @returns {Object} Time period, energy preference, and factor
 */
function getTimeOfDayFactor() {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) return { period: "morning", energyPreference: "moderate", factor: 0.6 };
  if (hour >= 12 && hour < 18) return { period: "afternoon", energyPreference: "high", factor: 0.75 };
  if (hour >= 18 && hour < 22) return { period: "evening", energyPreference: "moderate", factor: 0.65 };
  return { period: "night", energyPreference: "low", factor: 0.4 };
}

/**
 * Scores candidate tracks using 12-factor algorithm
 * @param {Array} candidates - Candidate tracks to score
 * @param {Object} profile - Session profile from buildSessionProfile
 * @param {Object} skipPatterns - Skip patterns from getSkipPatterns
 * @param {string} guildId - Guild identifier
 * @returns {Array} Sorted candidates with scores
 */
function scoreCandidates(candidates, profile, skipPatterns, guildId) {
  const timeOfDay = getTimeOfDayFactor();

  if (!sessionStartTime.has(guildId)) {
    sessionStartTime.set(guildId, Date.now());
  }

  candidates.forEach((candidate) => {
    let score = 50;
    const scoringDetails = [];

    // Factor 1: Artist familiarity
    const artistWeight = profile.artistCounts[candidate.artist] || 0;
    const artistScore = artistWeight * 5;
    score += artistScore;
    if (artistScore > 0) scoringDetails.push(`artist:+${artistScore}`);

    // Factor 2: Duration similarity
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

    // Factor 3: Source quality
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

    // Factor 4: Genre matching
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

    // Factor 5: Tempo/BPM consistency
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

    // Factor 6: Time-of-day awareness
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

    // Factor 7: Popularity weighting
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

    // Factor 8: Mood progression
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

    // Factor 9: Energy arc management
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

    // Factor 10: Artist diversity
    const isRecentArtist = profile.topArtists.slice(0, 3).some((a) => a.artist === candidate.artist);
    if (!isRecentArtist) {
      score += 20;
      scoringDetails.push("diversity:+20");
    } else {
      score -= 10;
      scoringDetails.push("diversity:-10");
    }

    // Factor 11: Skip learning
    const skipCount = skipPatterns.skippedArtists[candidate.artist] || 0;
    if (skipCount > 0) {
      const skipPenalty = skipCount * 20;
      score -= skipPenalty;
      scoringDetails.push(`skipArtist:-${skipPenalty}`);
    }

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

    // Factor 12: Duplicate prevention
    const isDuplicate = profile.recentIdentifiers.includes(candidate.identifier);
    if (isDuplicate) {
      score -= 1000;
      scoringDetails.push("duplicate:-1000");
    }

    candidate.score = Math.max(0, score);
    candidate.scoringDetails = scoringDetails;
  });

  candidates.sort((a, b) => b.score - a.score);

  // Add variety among top candidates
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

module.exports = {
  scoreCandidates,
  getTimeOfDayFactor,
};
