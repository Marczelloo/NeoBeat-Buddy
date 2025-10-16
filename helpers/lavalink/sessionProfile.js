const Log = require("../logs/log");
const { playbackState } = require("./state");

const sessionStartTime = new Map();
const genreCache = new Map();

/**
 * Builds a comprehensive profile of the listening session
 * @param {string} guildId - Guild identifier
 * @param {Object} referenceTrack - Current or last played track
 * @returns {Object} Session profile with artists, genres, features, trends
 */
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

    const cachedData = track.userData?.genres ? track.userData : genreCache.get(id);
    const cachedGenres = cachedData?.genres || [];
    const cachedFeatures = cachedData?.features;
    const cachedYear = cachedData?.releaseYear;

    cachedGenres.forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });

    if (cachedFeatures) {
      featuresList.push(cachedFeatures);
      energyValues.push(cachedFeatures.energy);
      valenceValues.push(cachedFeatures.valence);
      if (cachedFeatures.tempo) {
        tempos.push(cachedFeatures.tempo);
      }
    }

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
    .map((t) => t.info?.author)
    .filter(Boolean);

  return {
    topArtists,
    artistCounts,
    avgDuration,
    totalTracks: recentTracks.length,
    recentIdentifiers: identifiers.slice(-20),
    lastThreeArtists,
    topGenres,
    genreCounts,
    avgFeatures,
    avgTempo,
    avgYear,
    energyTrend,
    valenceTrend,
  };
}

module.exports = {
  buildSessionProfile,
  sessionStartTime,
  genreCache,
};
