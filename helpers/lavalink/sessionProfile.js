const Log = require("../logs/log");
const { getGenreFamilies, normalizeGenreTags } = require("./genreUtils");
const { playbackState } = require("./state");
const { cleanArtistName } = require("./trackNormalization");

const sessionStartTime = new Map();
const genreCache = new Map();
const AUTOPLAY_VIBE_WEIGHT = 0.3;

function isAutoplayTrack(track) {
  return Boolean(track?.userData?.autoplay || track?.info?.autoplayed);
}

function getTrackMetadata(track) {
  const identifier = track?.info?.identifier;
  const direct = track?.userData || {};
  const cached = genreCache.get(identifier) || {};
  const artist = cleanArtistName(direct.autoplayReference?.artist || track?.info?.author);
  const title = direct.autoplayReference?.title || track?.info?.title;
  const rawGenres = Array.isArray(direct.genres) && direct.genres.length > 0 ? direct.genres : cached.genres || [];

  return {
    genres: normalizeGenreTags(rawGenres, { artist, title }),
    features: direct.features || cached.features || null,
    derivedFeatures: direct.derivedFeatures || cached.derivedFeatures || null,
    releaseYear: direct.releaseYear || cached.releaseYear || null,
  };
}

function getSessionArtist(track) {
  return cleanArtistName(track?.userData?.autoplayReference?.artist || track?.info?.author || "Unknown") || "Unknown";
}

/**
 * Builds a comprehensive profile of the listening session
 * @param {string} guildId - Guild identifier
 * @param {Object} referenceTrack - Current or last played track
 * @returns {Object} Session profile with artists, genres, features, trends
 */
function buildSessionProfile(guildId, referenceTrack) {
  const state = playbackState.get(guildId);
  const history = state?.history || [];
  const recentAutoplayTracks = (state?.autoplayHistory || []).map((entry) => entry.track).filter(Boolean).slice(-20);

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
  const cooldownTracks = [...history, referenceTrack, ...recentAutoplayTracks].filter(Boolean).slice(-160);

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
      referenceGenres: [],
      referenceGenreFamilies: [],
      referenceFeatures: null,
      referenceDerivedFeatures: null,
      avgDerivedFeatures: null,
      recentGenreFamilies: [],
      recentTracks: [],
      recentAutoplayTracks: [],
      cooldownTracks: [],
    };
  }

  const artistCounts = {};
  const genreCounts = {};
  let totalDuration = 0;
  const identifiers = [];
  const featuresList = [];
  const derivedFeaturesList = [];
  const tempos = [];
  const years = [];
  const energyValues = [];
  const valenceValues = [];
  const recentGenreFamilies = [];
  let referenceMetadata = { genres: [], features: null, derivedFeatures: null, releaseYear: null };

  let profileWeightTotal = 0;

  recentTracks.forEach((track, index) => {
    const artist = getSessionArtist(track);
    const duration = track.info?.length || 0;
    const id = track.info?.identifier;

    // The room's manual selections are the anchor. Autoplay entries still
    // influence continuity, but cannot slowly teach the recommender to drift
    // away from what listeners actually selected.
    const trackWeight = isAutoplayTrack(track) ? AUTOPLAY_VIBE_WEIGHT : 1;
    profileWeightTotal += trackWeight;
    artistCounts[artist] = (artistCounts[artist] || 0) + trackWeight;
    totalDuration += duration;
    if (id) identifiers.push(id);

    const metadata = getTrackMetadata(track);
    const cachedGenres = metadata.genres;
    const cachedFeatures = metadata.features;
    const cachedYear = metadata.releaseYear;

    if (index === recentTracks.length - 1) {
      referenceMetadata = metadata;
    }

    cachedGenres.forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + trackWeight;
    });
    recentGenreFamilies.push(...getGenreFamilies(cachedGenres));

    if (cachedFeatures) {
      featuresList.push(cachedFeatures);
      if (Number.isFinite(cachedFeatures.energy)) energyValues.push(cachedFeatures.energy);
      if (Number.isFinite(cachedFeatures.valence)) valenceValues.push(cachedFeatures.valence);
      if (Number.isFinite(cachedFeatures.tempo)) {
        tempos.push(cachedFeatures.tempo);
      }
    }

    if (metadata.derivedFeatures) derivedFeaturesList.push(metadata.derivedFeatures);

    if (cachedYear) {
      years.push(cachedYear);
    }
  });

  const topArtists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count, weight: count / profileWeightTotal }));

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count, weight: count / profileWeightTotal }));

  const avgDuration = totalDuration / recentTracks.length;

  let avgFeatures = null;
  if (featuresList.length > 0) {
    const averageFeature = (name) => {
      const values = featuresList.map((features) => features[name]).filter(Number.isFinite);
      return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };

    avgFeatures = {
      energy: averageFeature("energy"),
      danceability: averageFeature("danceability"),
      valence: averageFeature("valence"),
      acousticness: averageFeature("acousticness"),
      tempo: averageFeature("tempo"),
    };
  }

  let avgDerivedFeatures = null;
  if (derivedFeaturesList.length > 0) {
    const averageDerivedFeature = (name) => {
      const values = derivedFeaturesList.map((features) => features[name]).filter(Number.isFinite);
      return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };

    avgDerivedFeatures = {
      energy: averageDerivedFeature("energy"),
      danceability: averageDerivedFeature("danceability"),
      valence: averageDerivedFeature("valence"),
    };
  }

  const avgTempo = tempos.length > 0 ? tempos.reduce((sum, t) => sum + t, 0) / tempos.length : null;

  const avgYear = years.length > 0 ? Math.round(years.reduce((sum, y) => sum + y, 0) / years.length) : null;

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

  // Track last 3 artists to prevent consecutive plays
  const lastThreeArtists = recentTracks
    .slice(-3)
    .map(getSessionArtist)
    .filter(Boolean);

  const cooldownIdentifiers = cooldownTracks.map((track) => track.info?.identifier).filter(Boolean);

  return {
    topArtists,
    artistCounts,
    avgDuration,
    totalTracks: recentTracks.length,
    recentIdentifiers: [...new Set(cooldownIdentifiers)].slice(-160),
    lastThreeArtists,
    topGenres,
    genreCounts,
    avgFeatures,
    avgTempo,
    avgYear,
    energyTrend,
    valenceTrend,
    referenceGenres: referenceMetadata.genres,
    referenceGenreFamilies: getGenreFamilies(referenceMetadata.genres),
    referenceFeatures: referenceMetadata.features,
    referenceDerivedFeatures: referenceMetadata.derivedFeatures,
    avgDerivedFeatures,
    recentGenreFamilies,
    recentTracks,
    recentAutoplayTracks,
    cooldownTracks,
  };
}

module.exports = {
  buildSessionProfile,
  getTrackMetadata,
  isAutoplayTrack,
  sessionStartTime,
  genreCache,
};
