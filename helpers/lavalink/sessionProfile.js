const Log = require("../logs/log");
const { getGenreFamilies } = require("./genreUtils");
const { playbackState } = require("./state");

const sessionStartTime = new Map();
const genreCache = new Map();

function getTrackMetadata(track) {
  const identifier = track?.info?.identifier;
  const direct = track?.userData || {};
  const cached = genreCache.get(identifier) || {};

  return {
    genres: Array.isArray(direct.genres) && direct.genres.length > 0 ? direct.genres : cached.genres || [],
    features: direct.features || cached.features || null,
    releaseYear: direct.releaseYear || cached.releaseYear || null,
  };
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
      recentGenreFamilies: [],
      recentTracks: [],
      recentAutoplayTracks: [],
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
  const recentGenreFamilies = [];
  let referenceMetadata = { genres: [], features: null, releaseYear: null };

  recentTracks.forEach((track, index) => {
    const artist = track.info?.author || "Unknown";
    const duration = track.info?.length || 0;
    const id = track.info?.identifier;

    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
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
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
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

  const autoplayIdentifiers = recentAutoplayTracks.map((track) => track.info?.identifier).filter(Boolean);

  return {
    topArtists,
    artistCounts,
    avgDuration,
    totalTracks: recentTracks.length,
    recentIdentifiers: [...identifiers, ...autoplayIdentifiers].slice(-20),
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
    recentGenreFamilies,
    recentTracks,
    recentAutoplayTracks,
  };
}

module.exports = {
  buildSessionProfile,
  getTrackMetadata,
  sessionStartTime,
  genreCache,
};
