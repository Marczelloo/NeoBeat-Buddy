const Log = require("../logs/log");
const { getExposureKey, getExposureRecord } = require("./autoplayExposure");
const { getFeatureCoverage, getTempoDistance } = require("./autoplayMetadata");
const { areGenreFamiliesCompatible, findGenreOverlap, getGenreFamilies, normalizeGenreTags } = require("./genreUtils");
const { sessionStartTime } = require("./sessionProfile");
const { hasTrackIdentity } = require("./trackIdentity");
const {
  cleanArtistName,
  getAutoplayVersionCompatibility,
  normalizeComparableText,
} = require("./trackNormalization");

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

const hasNumber = (value) => Number.isFinite(value);
function normalizeSimilarity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function normalizeArtist(value) {
  return normalizeComparableText(cleanArtistName(value)).replace(/\s+/g, "");
}

function getCandidateFeatures(candidate) {
  return {
    ...(candidate?.derivedFeatures || {}),
    ...(candidate?.features || {}),
  };
}

function getReferenceFeatures(profile = {}) {
  return {
    ...(profile.avgDerivedFeatures || {}),
    ...(profile.avgFeatures || {}),
    ...(profile.referenceDerivedFeatures || {}),
    ...(profile.referenceFeatures || {}),
  };
}

function hasSessionVibeAnchor(profile = {}) {
  return Boolean(
    profile.referenceGenreFamilies?.length ||
      profile.referenceGenres?.length ||
      Object.keys(getReferenceFeatures(profile)).length > 0 ||
      profile.topGenres?.length ||
      profile.avgFeatures
  );
}

function getVibeEvidence(candidate, profile, candidateFamilies, referenceFamilies, referenceGenres) {
  const similarity = normalizeSimilarity(candidate?.similarity);
  const features = getCandidateFeatures(candidate);
  const referenceFeatures = getReferenceFeatures(profile);
  const genreCompatibility = areGenreFamiliesCompatible(referenceFamilies, candidateFamilies);
  const sharedGenres = findGenreOverlap(referenceGenres, candidate?.genres || []);
  const featureDistances = [];

  if (hasNumber(features.tempo) && hasNumber(referenceFeatures.tempo)) {
    featureDistances.push({ field: "tempo", distance: getTempoDistance(features.tempo, referenceFeatures.tempo) });
  }
  for (const field of ["energy", "valence", "danceability"]) {
    if (hasNumber(features[field]) && hasNumber(referenceFeatures[field])) {
      featureDistances.push({ field, distance: Math.abs(features[field] - referenceFeatures[field]) });
    }
  }

  const closeFeatureCount = featureDistances.filter(({ field, distance }) =>
    field === "tempo" ? distance < 30 : distance < 0.3
  ).length;
  const hasFeatureContinuity = closeFeatureCount > 0;
  const hasCompatibleGenre = genreCompatibility === true || sharedGenres.length > 0;
  const hasStrongSimilarity = similarity >= 0.72;
  const hasAnySimilarity = similarity > 0.12;
  const noAnchorMix = candidate?.source === "youtube_mix" && !hasSessionVibeAnchor(profile);

  return {
    similarity,
    featureCoverage: getFeatureCoverage(features),
    genreCompatibility,
    sharedGenres,
    hasFeatureContinuity,
    hasCompatibleGenre,
    hasStrongSimilarity,
    hasAnySimilarity,
    noAnchorMix,
    confidence:
      hasCompatibleGenre || hasFeatureContinuity || hasStrongSimilarity
        ? "high"
        : hasAnySimilarity || getFeatureCoverage(features) > 0
          ? "medium"
          : noAnchorMix
            ? "fallback"
            : "low",
  };
}

function getArtistWeight(artistCounts, artist) {
  const candidateKey = normalizeArtist(artist);
  return Object.entries(artistCounts || {}).reduce(
    (weight, [knownArtist, knownWeight]) => weight + (normalizeArtist(knownArtist) === candidateKey ? Number(knownWeight) || 0 : 0),
    0
  );
}

function getAutoplayExposurePenalty(candidate, profile, now = Date.now()) {
  const snapshot = profile?.autoplayExposure;
  const candidateKey = getExposureKey(candidate);
  if (!snapshot || !candidateKey) return { penalty: 0, candidateKey, transitionKey: null };

  const trackRecord = getExposureRecord(snapshot, candidateKey);
  const ttlMs = Math.max(Number(snapshot.ttlMs) || 0, 1);
  const halfLifeMs = Math.max(ttlMs / 3, 60 * 60 * 1000);
  const ageFactor = (lastSeen) => {
    const ageMs = Math.max(0, now - Number(lastSeen || 0));
    return Math.exp(-ageMs / halfLifeMs);
  };

  let penalty = 0;
  if (trackRecord) {
    const freshness = ageFactor(trackRecord.lastSeen);
    const repeatBonus = Math.min(Math.max(Number(trackRecord.count) || 1, 1) - 1, 4) * 4;
    penalty += (10 + repeatBonus) * freshness;
  }

  const referenceKey = profile.autoplayReferenceKey;
  const transitionKey = referenceKey ? `${referenceKey}=>${candidateKey}` : null;
  const transitionRecord = getExposureRecord(snapshot, transitionKey, "transitions");
  if (transitionRecord) {
    penalty += 12 * ageFactor(transitionRecord.lastSeen);
  }

  return {
    penalty: Math.min(36, Number(penalty.toFixed(2))),
    candidateKey,
    transitionKey,
  };
}

function getCandidateVibeTrust(candidate, profile, candidateFamilies, referenceFamilies, referenceGenres) {
  const similarity = normalizeSimilarity(candidate.similarity);
  let trust = similarity * 100;

  if (areGenreFamiliesCompatible(referenceFamilies, candidateFamilies) === true) trust = Math.max(trust, 45);
  if (findGenreOverlap(referenceGenres, candidate.genres || []).length > 0) trust = Math.max(trust, 55);

  const candidateFeatures = getCandidateFeatures(candidate);
  const referenceFeatures = getReferenceFeatures(profile);
  if (Object.keys(candidateFeatures).length && Object.keys(referenceFeatures).length) {
    const comparable = ["tempo", "energy", "valence"].filter(
      (field) => hasNumber(candidateFeatures[field]) && hasNumber(referenceFeatures[field])
    );
    if (comparable.length) trust = Math.max(trust, 70);
  }

  return trust;
}

function getMetadataConfidence(candidate) {
  const coverage = getFeatureCoverage(getCandidateFeatures(candidate));
  if (coverage >= 3) return 1;
  if (coverage > 0) return Math.max(Number(candidate?.metadataConfidence) || 0, 0.45);
  if (candidate?.metadataChecked) return Math.max(Number(candidate?.metadataConfidence) || 0, 0.05);
  return null;
}

function getProfileGenres(topGenres = []) {
  const weights = new Map();

  for (const entry of topGenres) {
    const [genre] = normalizeGenreTags([entry?.genre]);
    if (!genre) continue;
    weights.set(genre, Math.max(weights.get(genre) || 0, Number(entry?.weight) || 0));
  }

  return [...weights.entries()].map(([genre, weight]) => ({ genre, weight }));
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
    let genreBonus = 0;
    const scoringDetails = [];
    candidate.hardRejected = false;
    candidate.deferred = false;
    candidate.deferredReason = null;

    candidate.genres = normalizeGenreTags(candidate.genres, { artist: candidate.artist, title: candidate.title });
    const candidateFamilies = getGenreFamilies(candidate.genres);
    const sessionGenres = (profile.topGenres || []).map((item) => item.genre).filter(Boolean);
    const referenceFamilies = profile.referenceGenreFamilies?.length
      ? profile.referenceGenreFamilies
      : getGenreFamilies(sessionGenres);
    const referenceGenres = normalizeGenreTags([...(profile.referenceGenres || []), ...sessionGenres]);
    const candidateFeatures = getCandidateFeatures(candidate);
    const referenceFeatures = getReferenceFeatures(profile);
    candidate.genreFamilies = candidateFamilies;

    const versionCompatibility = getAutoplayVersionCompatibility(
      candidate.title,
      profile.referenceTitleRaw || ""
    );
    candidate.versionMode = versionCompatibility.mode;
    if (!versionCompatibility.allowed) {
      score -= 1000;
      candidate.hardRejected = true;
      candidate.rejectionReason = "unmatched-alternate-version";
      scoringDetails.push(`version:-1000(${versionCompatibility.mode})`);
    } else if (versionCompatibility.mode === "tempo-style") {
      score += 4;
      scoringDetails.push("version:+4(tempo-style)");
    } else if (versionCompatibility.mode === "tempo-consistent") {
      score += 8;
      scoringDetails.push("version:+8(tempo-consistent)");
    }

    // A loose provider search is never allowed to become the escape hatch
    // that turns an empty recommendation pool into a completely unrelated
    // song. Direct similarity, metadata, or audio features are required for
    // every automatic pick, including sessions whose reference has no tags.
    const vibeEvidence = getVibeEvidence(candidate, profile, candidateFamilies, referenceFamilies, referenceGenres);
    const hasMusicSignal =
      vibeEvidence.hasAnySimilarity ||
      vibeEvidence.hasCompatibleGenre ||
      vibeEvidence.hasFeatureContinuity;
    const isMetadataFreeMix = vibeEvidence.noAnchorMix && !hasMusicSignal;
    const hasReliableSignal = hasMusicSignal || isMetadataFreeMix;
    candidate.vibeConfidence = vibeEvidence.confidence;
    candidate.fallbackOnly = false;
    if (isMetadataFreeMix) {
      candidate.fallbackOnly = true;
      candidate.rejectionReason = "metadata-free-mix-fallback";
      scoringDetails.push("fallback-only(metadata-free-mix)");
    } else if (!hasReliableSignal) {
      score -= 1000;
      candidate.hardRejected = true;
      candidate.rejectionReason = candidate.isFallback ? "fallback-without-vibe-signal" : "unverified-provider-candidate";
      scoringDetails.push(`${candidate.isFallback ? "fallback" : "provider"}:-1000(no-vibe-signal)`);
    }

    // A provider recommendation without a bridge to the current track is not
    // a safe autoplay pick. Keep direct Mix tracks for the explicit fallback
    // lane, but do not let a random Deezer/Last.fm catalog result win merely
    // because it has a generic tag or a source bonus.
    if (
      !candidate.hardRejected &&
      hasSessionVibeAnchor(profile) &&
      !vibeEvidence.hasCompatibleGenre &&
      !vibeEvidence.hasFeatureContinuity &&
      !vibeEvidence.hasStrongSimilarity
    ) {
      score -= 1000;
      candidate.hardRejected = true;
      candidate.rejectionReason = "no-transition-bridge";
      scoringDetails.push("transition:-1000(no-bridge)");
    }

    // The last track is the strongest signal. Do not allow a known genre-family
    // jump such as rap -> metal just because the source has a high quality bonus.
    const transitionCompatibility = areGenreFamiliesCompatible(referenceFamilies, candidateFamilies);
    if (transitionCompatibility === false) {
      score -= 90;
      candidate.hardRejected = true;
      candidate.rejectionReason = "incompatible-genre-family";
      scoringDetails.push("transition:-90(genre-drift)");
    } else if (transitionCompatibility === true) {
      genreBonus += 12;
      scoringDetails.push("transition:compatible-vibe");
    }

    const exactReferenceOverlap = findGenreOverlap(referenceGenres, candidate.genres || []);
    if (exactReferenceOverlap.length > 0) {
      genreBonus += 8;
      scoringDetails.push("transition:shared-subgenre");
    }

    // Softly discourage leaving the dominant session family while still
    // allowing a compatible bridge between related styles.
    const dominantFamilies = getGenreFamilies((profile.topGenres || []).slice(0, 4).map((item) => item.genre));
    if (!candidate.hardRejected && candidateFamilies.length > 0 && dominantFamilies.length > 0) {
      const sessionCompatibility = areGenreFamiliesCompatible(dominantFamilies, candidateFamilies);
      if (sessionCompatibility === false && profile.totalTracks >= 3) {
        score -= 35;
        scoringDetails.push("sessionVibe:-35(drift)");
      }
    }

    // Keep the session varied without forcing a genre change when the vibe is
    // working: repeating one family three or more times gets a soft penalty.
    if (candidateFamilies.length > 0 && profile.recentGenreFamilies?.length > 0) {
      const recentFamilyCounts = profile.recentGenreFamilies.reduce((counts, family) => {
        counts[family] = (counts[family] || 0) + 1;
        return counts;
      }, {});
      const repeatedFamilies = candidateFamilies.filter((family) => (recentFamilyCounts[family] || 0) >= 3);
      if (repeatedFamilies.length === candidateFamilies.length) {
        const highestRepeat = Math.max(...repeatedFamilies.map((family) => recentFamilyCounts[family] || 0));
        const penalty = highestRepeat >= 6 ? 22 : 14;
        score -= penalty;
        scoringDetails.push(`genreVariety:-${penalty}(repeated-family)`);
      }
    }

    // Factor 1: Artist familiarity
    const artistWeight = getArtistWeight(profile.artistCounts, candidate.artist);
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

    // Factor 3: Similarity source quality. Direct collaborative similarity is
    // much more useful than provider result order, but is still bounded so it
    // cannot overpower a hard genre or duplicate rejection.
    const similarity = normalizeSimilarity(candidate.similarity);
    if (similarity > 0) {
      const similarityScore = Math.round(similarity * 40);
      score += similarityScore;
      scoringDetails.push(`similarity:+${similarityScore}`);
    }

    if (candidate.source === "deezer_recommendations") {
      score += 5;
      scoringDetails.push("source:+5(deezer)");
    } else if (candidate.source === "spotify_recommendations") {
      score += 3;
      scoringDetails.push("source:+3(spotify)");
    } else if (candidate.source === "spotify") {
      // Legacy support
      score += 3;
      scoringDetails.push("source:+3(spotify)");
    } else if (candidate.source === "youtube_mix") {
      score += 5;
      scoringDetails.push("source:+5(yt-mix)");
    } else if (candidate.source === "lastfm_similar") {
      score += 8;
      scoringDetails.push("source:+8(lastfm)");
    }

    // Factor 4: Genre matching. Community tags are noisy and frequently
    // repetitive, so their influence is deliberately capped below direct
    // similarity and audio-feature continuity.
    const profileGenres = getProfileGenres(profile.topGenres);
    const profileFamilies = getGenreFamilies(profileGenres.map((entry) => entry.genre));
    if (candidate.genres.length > 0 && profileGenres.length > 0) {
      const sharedTags = findGenreOverlap(profileGenres.map((entry) => entry.genre), candidate.genres);
      const sharesFamily = candidateFamilies.some((family) => profileFamilies.includes(family));
      const sharesCompatibleFamily = areGenreFamiliesCompatible(profileFamilies, candidateFamilies) === true;
      const strongestTagWeight = sharedTags.reduce(
        (weight, genre) => Math.max(weight, profileGenres.find((entry) => entry.genre === genre)?.weight || 0),
        0
      );
      const genreMatchScore =
        (sharedTags.length ? 10 + Math.round(strongestTagWeight * 8) : 0) +
        (sharesFamily ? 8 : sharesCompatibleFamily ? 4 : 0);

      genreBonus += genreMatchScore;
      if (genreMatchScore > 0) scoringDetails.push("genre:profile-match");

      if (genreMatchScore === 0 && profileFamilies.length >= 2) {
        score -= 25;
        scoringDetails.push("genreDrift:-25");
      }
    } else if (profileFamilies.length >= 2) {
      score -= 10;
      scoringDetails.push("noGenre:-10");
    }

    // Every positive genre-derived signal shares one budget. This keeps a
    // generic tag such as "pop" from outweighing direct Last.fm similarity or
    // audio-feature continuity simply because it appears at multiple stages.
    if (genreBonus > 0) {
      const cappedGenreBonus = Math.min(28, genreBonus);
      score += cappedGenreBonus;
      scoringDetails.push(`genre:+${cappedGenreBonus}(total-capped)`);
    }

    // Spotify audio features are unavailable to many Development Mode apps.
    // A Deezer catalog probe can still provide BPM/gain, so prefer candidates
    // with measured audio metadata and make an explicitly checked miss less
    // competitive than a candidate with a real tempo anchor. This is a soft
    // penalty: obscure uploads remain eligible when every provider is sparse.
    const metadataConfidence = getMetadataConfidence(candidate);
    const featureCoverage = getFeatureCoverage(candidateFeatures);
    if (metadataConfidence !== null) {
      if (featureCoverage >= 3) {
        score += 8;
        scoringDetails.push("metadata:+8(audio-profile)");
      } else if (hasNumber(candidateFeatures.tempo)) {
        score += 5;
        scoringDetails.push("metadata:+5(tempo-anchor)");
      } else if (candidate.metadataChecked && Object.keys(referenceFeatures).length) {
        score -= 12;
        scoringDetails.push("metadata:-12(no-tempo-anchor)");
      }
    }

    // Factor 5: Tempo/BPM consistency
    if (hasNumber(candidateFeatures.tempo) && hasNumber(profile.avgTempo)) {
      const tempoDiff = getTempoDistance(candidateFeatures.tempo, profile.avgTempo);

      if (tempoDiff < 15) {
        score += 15;
        scoringDetails.push("tempo:+15");
      } else if (tempoDiff < 30) {
        score += 8;
        scoringDetails.push("tempo:+8");
      } else if (tempoDiff > 45) {
        score -= 5;
        scoringDetails.push("tempo:-5");
      }
    }

    // Direct transition continuity is more important than a long-term average;
    // it prevents an otherwise good recommendation from feeling like a hard cut.
    if (Object.keys(candidateFeatures).length && Object.keys(referenceFeatures).length) {
      if (hasNumber(candidateFeatures.tempo) && hasNumber(referenceFeatures.tempo)) {
        const tempoDiff = getTempoDistance(candidateFeatures.tempo, referenceFeatures.tempo);
        if (tempoDiff < 10) {
          score += 18;
          scoringDetails.push("continuity:+18(tempo)");
        } else if (tempoDiff < 22) {
          score += 10;
          scoringDetails.push("continuity:+10(tempo)");
        } else if (tempoDiff > 40) {
          score -= 20;
          scoringDetails.push("continuity:-20(tempo)");
        } else if (tempoDiff > 26) {
          score -= 8;
          scoringDetails.push("continuity:-8(tempo)");
        }
      }

      if (hasNumber(candidateFeatures.energy) && hasNumber(referenceFeatures.energy)) {
        const energyDiff = Math.abs(candidateFeatures.energy - referenceFeatures.energy);
        if (energyDiff < 0.12) {
          score += 18;
          scoringDetails.push("continuity:+18(energy)");
        } else if (energyDiff < 0.25) {
          score += 10;
          scoringDetails.push("continuity:+10(energy)");
        } else if (energyDiff > 0.4) {
          score -= 20;
          scoringDetails.push("continuity:-20(energy)");
        }
      }

      if (hasNumber(candidateFeatures.valence) && hasNumber(referenceFeatures.valence)) {
        const valenceDiff = Math.abs(candidateFeatures.valence - referenceFeatures.valence);
        if (valenceDiff < 0.15) {
          score += 12;
          scoringDetails.push("continuity:+12(mood)");
        } else if (valenceDiff > 0.45) {
          score -= 12;
          scoringDetails.push("continuity:-12(mood)");
        }
      }
    }

    // Factor 6: Time-of-day awareness
    if (candidateFeatures.energy !== undefined) {
      const energyDiff = Math.abs(candidateFeatures.energy - timeOfDay.factor);

      if (energyDiff < 0.15) {
        score += 12;
        scoringDetails.push(`timeOfDay:+12(${timeOfDay.period})`);
      } else if (energyDiff < 0.3) {
        score += 6;
        scoringDetails.push(`timeOfDay:+6(${timeOfDay.period})`);
      }
    }

    // Factor 7: Catalog popularity is only a confidence tie-breaker. Last.fm
    // similarity is stored separately and must never be mistaken for it.
    if (candidate.popularity > 0) {
      if (candidate.popularity >= 50 && candidate.popularity <= 85) {
        score += 5;
        scoringDetails.push("popularity:+5");
      } else if (candidate.popularity < 25) {
        score -= 2;
        scoringDetails.push("popularity:-2(low-confidence)");
      }
    }

    // Factor 8: Mood progression
    if (
      candidateFeatures.valence !== undefined &&
      profile.valenceTrend &&
      profile.avgFeatures?.valence !== undefined &&
      profile.avgFeatures?.valence !== null
    ) {
      if (profile.valenceTrend === "increasing" && candidateFeatures.valence > profile.avgFeatures.valence) {
        score += 12;
        scoringDetails.push("mood:+12(rising)");
      } else if (profile.valenceTrend === "decreasing" && candidateFeatures.valence < profile.avgFeatures.valence) {
        score += 12;
        scoringDetails.push("mood:+12(falling)");
      } else if (profile.valenceTrend === "stable") {
        const valenceDiff = Math.abs(candidateFeatures.valence - profile.avgFeatures.valence);
        if (valenceDiff < 0.15) {
          score += 8;
          scoringDetails.push("mood:+8(stable)");
        }
      }
    }

    // Factor 9: Energy arc management
    if (
      candidateFeatures.energy !== undefined &&
      profile.energyTrend &&
      profile.avgFeatures?.energy !== undefined &&
      profile.avgFeatures?.energy !== null
    ) {
      if (profile.energyTrend === "increasing" && candidateFeatures.energy > profile.avgFeatures.energy) {
        score += 15;
        scoringDetails.push("energyArc:+15(building)");
      } else if (profile.energyTrend === "decreasing" && candidateFeatures.energy < profile.avgFeatures.energy) {
        score += 15;
        scoringDetails.push("energyArc:+15(winding)");
      } else if (profile.energyTrend === "stable") {
        const energyDiff = Math.abs(candidateFeatures.energy - profile.avgFeatures.energy);
        if (energyDiff < 0.15) {
          score += 10;
          scoringDetails.push("energyArc:+10(plateau)");
        }
      }
    }

    // Factor 10: Artist diversity is deliberately soft. A trusted, strongly
    // related follow-up by the same artist is better than an unrelated "new"
    // artist, while exact recordings remain blocked by duplicate prevention.
    const vibeTrust = getCandidateVibeTrust(candidate, profile, candidateFamilies, referenceFamilies, referenceGenres);
    const candidateArtistKey = normalizeArtist(candidate.artist);

    // Check artist recency
    const topArtistPosition = profile.topArtists.findIndex((a) => normalizeArtist(a.artist) === candidateArtistKey);
    const isInTop3 = topArtistPosition >= 0 && topArtistPosition < 3;
    const isInTop1 = topArtistPosition === 0;

    // Check if artist was played in last 3 tracks (prevents consecutive plays)
    const lastThreeArtists = profile.lastThreeArtists || [];
    const recentArtistKeys = lastThreeArtists.map(normalizeArtist).filter(Boolean);
    const recentAppearances = recentArtistKeys.filter((artist) => artist === candidateArtistKey).length;
    const appearsInLastThree = recentAppearances > 0;
    const isLastArtist =
      recentArtistKeys.length > 0 && recentArtistKeys[recentArtistKeys.length - 1] === candidateArtistKey;
    const isTrustedContinuation = vibeTrust >= 75;
    let consecutiveArtistStreak = 0;
    for (let index = recentArtistKeys.length - 1; index >= 0; index -= 1) {
      if (recentArtistKeys[index] !== candidateArtistKey) break;
      consecutiveArtistStreak += 1;
    }

    if (isLastArtist) {
      const penalty = isTrustedContinuation ? (recentAppearances >= 2 ? 22 : 10) : 40;
      score -= penalty;
      scoringDetails.push(`diversity:-${penalty}(consecutive${isTrustedContinuation ? "-trusted" : ""})`);
      // Keep a strong same-artist continuation available as an emergency
      // fallback, but do not let it beat a viable different artist once two
      // consecutive tracks by that artist have already played.
      if (consecutiveArtistStreak >= 2) {
        candidate.deferred = true;
        candidate.deferredReason = `artist-streak-${consecutiveArtistStreak + 1}`;
        scoringDetails.push(`diversity:defer(${candidate.deferredReason})`);
      }
    } else if (appearsInLastThree) {
      // A trusted relationship can safely revisit an artist after one song.
      if (vibeTrust >= 85) {
        score -= recentAppearances >= 2 ? 14 : 4;
        scoringDetails.push(`diversity:-${recentAppearances >= 2 ? 14 : 4}(recent-trusted)`);
      } else if (vibeTrust >= 60) {
        score -= 12;
        scoringDetails.push("diversity:-12(recent-good-vibe)");
      } else {
        score -= 22;
        scoringDetails.push("diversity:-22(recent-bad-vibe)");
      }
    } else if (isInTop3) {
      // Artist is in top 3 overall but not in last 3 tracks - apply dynamic penalty based on vibe match
      if (vibeTrust >= 80) {
        // Excellent vibe match - allow same artist with minimal penalty
        score -= 5;
        scoringDetails.push("diversity:-5(vibe-match)");
      } else if (vibeTrust >= 60) {
        // Good vibe match - moderate penalty
        score -= 12;
        scoringDetails.push("diversity:-12(similar-vibe)");
      } else if (vibeTrust >= 40) {
        // Weak vibe match - higher penalty
        score -= 20;
        scoringDetails.push("diversity:-20(weak-vibe)");
      } else {
        // Poor vibe match - heavy penalty for same artist
        score -= 30;
        scoringDetails.push("diversity:-30(off-vibe)");
      }

      // Extra penalty for most recent artist to prevent back-to-back plays
      if (isInTop1) {
        score -= 10;
        scoringDetails.push("diversity:-10(top-frequent)");
      }
    } else {
      // New artists are welcome only as a tie-breaker. A large bonus here was
      // the main reason a merely novel performer could beat a better match.
      score += 6;
      scoringDetails.push("diversity:+6(new-artist)");
    }

    // A compatible artist can return after a short break, but should not
    // dominate the radio by alternating with one other artist. Keep these
    // candidates available as an emergency pool when the source has no other
    // playable option.
    if (!candidate.deferred && recentAppearances >= 2 && recentArtistKeys.length >= 3) {
      const cooldownPenalty = isTrustedContinuation ? 28 : 40;
      score -= cooldownPenalty;
      candidate.deferred = true;
      candidate.deferredReason = `artist-cooldown-${recentAppearances}`;
      scoringDetails.push(`diversity:defer(${candidate.deferredReason})`);
    }

    // Factor 11: Skip learning
    const skipCount = skipPatterns.skippedArtists[candidate.artist] || 0;
    if (skipCount > 0) {
      const skipPenalty = skipCount * 20;
      score -= skipPenalty;
      scoringDetails.push(`skipArtist:-${skipPenalty}`);
    }

    if (candidate.genres.length > 0) {
      const normalizedSkippedGenres = Object.entries(skipPatterns.skippedGenres || {}).reduce((counts, [genre, count]) => {
        const [normalized] = normalizeGenreTags([genre]);
        if (normalized) counts[normalized] = (counts[normalized] || 0) + (Number(count) || 0);
        return counts;
      }, {});
      candidate.genres.forEach((genre) => {
        const genreSkipCount = normalizedSkippedGenres[genre] || 0;
        if (genreSkipCount > 0) {
          const genreSkipPenalty = genreSkipCount * 15;
          score -= genreSkipPenalty;
          scoringDetails.push(`skipGenre:-${genreSkipPenalty}`);
        }
      });
    }

    // Remembered exposure is intentionally a soft cross-session penalty. The
    // current session's history still owns hard duplicate rejection below,
    // while this layer prevents a freshly restarted room from replaying the
    // same Last.fm path immediately.
    const exposure = getAutoplayExposurePenalty(candidate, profile);
    if (exposure.penalty > 0) {
      score -= exposure.penalty;
      scoringDetails.push(`exposure:-${exposure.penalty}`);
      candidate.exposurePenalty = exposure.penalty;
    } else {
      candidate.exposurePenalty = 0;
    }

    // Factor 12: Duplicate prevention (identifier-based)
    const isDuplicateById = candidate.identifier && (profile.recentIdentifiers || []).includes(candidate.identifier);
    if (isDuplicateById) {
      score -= 1000;
      candidate.hardRejected = true;
      candidate.rejectionReason = "recent-duplicate";
      scoringDetails.push("duplicate:-1000(id)");
    }

    // Provider identifiers differ for the same recording. Compare a normalized
    // artist/title identity as well, including tracks reserved by an in-flight
    // or already queued autoplay recommendation.
    const recentTracks = profile.cooldownTracks || [...(profile.recentTracks || []), ...(profile.recentAutoplayTracks || [])];
    const isDuplicateByTitle = !isDuplicateById && hasTrackIdentity(recentTracks, candidate, { includeIdentifier: false });

    if (isDuplicateByTitle) {
        score -= 1000;
        candidate.hardRejected = true;
        candidate.rejectionReason = "recent-duplicate";
        scoringDetails.push("duplicate:-1000(title)");
    }

    candidate.score = Math.max(0, score);
    candidate.scoringDetails = scoringDetails;
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const similarityDifference = normalizeSimilarity(b.similarity) - normalizeSimilarity(a.similarity);
    if (similarityDifference !== 0) return similarityDifference;
    return `${a.artist || ""} ${a.title || ""}`.localeCompare(`${b.artist || ""} ${b.title || ""}`);
  });

  // Add variety among top candidates
  const topScore = candidates.length > 0 ? candidates[0].score : 0;
  const topCandidates = candidates.filter((c) => c.score >= topScore - 10 && c.score > 0);

  if (topCandidates.length > 1) {
    topCandidates.forEach((c) => {
      // Stable tie-breaker keeps autoplay varied without making decisions
      // change randomly on every invocation.
      c.score += (((c.artist?.length || 0) + (c.title?.length || 0)) % 5) / 100;
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
  normalizeArtist,
  getCandidateVibeTrust,
  getAutoplayExposurePenalty,
  getMetadataConfidence,
};
