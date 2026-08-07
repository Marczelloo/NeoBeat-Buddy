const Log = require("../logs/log");
const {
  searchSpotifyTrack,
  getTrackDetails,
  getArtistGenres,
  getArtistGenresById,
  getAudioFeatures,
  fetchSpotifyRecommendations,
} = require("./spotifyClient");

const metadataCache = new Map();
const METADATA_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Gets Spotify-based recommendations with enhanced metadata
 * @param {string} seedTrackId - Spotify seed track ID
 * @param {number} limit - Number of recommendations
 * @param {Array<string>} targetGenres - Target genres
 * @param {Object} targetFeatures - Target audio features
 * @returns {Promise<Array>} Enriched recommendations with genres and features
 */
async function getSpotifyRecommendations(seedTrackId, limit = 10, targetGenres = [], targetFeatures = null) {
  const recommendations = await fetchSpotifyRecommendations(
    seedTrackId,
    Math.max(limit * 2, 10),
    targetGenres,
    targetFeatures
  );
  if (recommendations.length === 0) return [];

  const artistIds = recommendations.flatMap((track) => track.artists.map((a) => a.id));
  const artistGenresMap = new Map();

  if (artistIds.length > 0) {
    const uniqueArtistIds = [...new Set(artistIds)];
    const genresByArtist = await getArtistGenresById(uniqueArtistIds);
    uniqueArtistIds.forEach((artistId) => {
      artistGenresMap.set(artistId, genresByArtist.get(artistId) || []);
    });
  }

  const trackIds = recommendations.map((t) => t.id);
  const audioFeaturesMap = await getAudioFeatures(trackIds);

  Log.info(
    "Spotify recommendations fetched",
    "",
    `seed=${seedTrackId}`,
    `count=${recommendations.length}`,
    `targetGenres=${targetGenres.join(", ")}`,
    `targetTempo=${targetFeatures?.tempo ? Math.round(targetFeatures.tempo) : "none"}`,
    `artists=${recommendations
      .slice(0, 3)
      .map((t) => t.artists[0]?.name)
      .join(", ")}`
  );

  const enriched = recommendations.map((track) => {
    const trackGenres = new Set();
    track.artists.forEach((artist) => {
      const genres = artistGenresMap.get(artist.id) || [];
      genres.forEach((g) => trackGenres.add(g));
    });

    const releaseDate = track.album?.release_date;
    const releaseYear = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;

    return {
      title: track.name,
      artist: track.artists[0]?.name || "Unknown",
      artistNames: track.artists.map((a) => a.name),
      artistIds: track.artists.map((a) => a.id),
      genres: Array.from(trackGenres),
      spotifyId: track.id,
      popularity: track.popularity || 0,
      releaseYear,
      features: audioFeaturesMap.get(track.id) || null,
    };
  });

  // Fetch a slightly wider pool, then choose the tracks closest to the current
  // vibe instead of whichever results happened to come back first.
  return enriched
    .map((track) => {
      const genreMatch = targetGenres.some((targetGenre) =>
        track.genres.some(
          (genre) => genre === targetGenre || genre.includes(targetGenre) || targetGenre.includes(genre)
        )
      );
      let relevance = genreMatch ? 30 : 0;

      if (targetFeatures && track.features) {
        const distances = [
          ["tempo", 60],
          ["energy", 1],
          ["valence", 1],
          ["danceability", 1],
        ]
          .filter(([name]) => Number.isFinite(targetFeatures[name]) && Number.isFinite(track.features[name]))
          .map(([name, scale]) => Math.abs(track.features[name] - targetFeatures[name]) / scale);

        if (distances.length > 0) {
          const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
          relevance += Math.max(0, 25 - averageDistance * 25);
        }
      }

      return { track, relevance };
    })
    .sort((left, right) => right.relevance - left.relevance || right.track.popularity - left.track.popularity)
    .slice(0, limit)
    .map(({ track }) => track);
}

/**
 * Gets Spotify-based suggestions from a reference track
 * @param {Object} referenceTrack - Reference track to base recommendations on
 * @returns {Promise<Array>} Enriched recommendations
 */
async function getSpotifyBasedSuggestions(referenceTrack, profile = {}) {
  if (!referenceTrack?.info) return [];

  const { title, author } = referenceTrack.info;

  const trackId = await searchSpotifyTrack(title, author);

  if (!trackId) {
    Log.warning("Could not find reference track on Spotify", "", `title=${title}`, `artist=${author}`);
    return [];
  }

  const targetGenres = (profile.topGenres || []).slice(0, 3).map((genre) => genre.genre);
  const targetFeatures = profile.referenceFeatures || profile.avgFeatures || null;
  const recommendations = await getSpotifyRecommendations(trackId, 8, targetGenres, targetFeatures);

  return recommendations;
}

/**
 * Enrich source candidates that do not carry audio metadata. This keeps
 * YouTube/Deezer fallbacks from becoming genre-blind when Spotify is available.
 */
async function enrichCandidatesWithSpotifyMetadata(candidates, limit = 6) {
  const targets = candidates
    .filter((candidate) => !candidate.genres?.length || !candidate.features)
    .slice(0, limit);

  await Promise.all(
    targets.map(async (candidate) => {
      const cacheKey = `${candidate.artist}|${candidate.title}`.toLowerCase();
      const cached = metadataCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL_MS) {
        Object.assign(candidate, cached.metadata);
        return;
      }

      const spotifyId = await searchSpotifyTrack(candidate.title, candidate.artist);
      if (!spotifyId) return;

      const details = await getTrackDetails(spotifyId);
      if (!details) return;

      const genres = await getArtistGenres(details.artistIds || []);
      const metadata = {
        genres,
        popularity: candidate.popularity || details.popularity || 0,
        releaseYear: candidate.releaseYear || details.releaseYear || null,
        features: candidate.features || details.features || null,
      };

      Object.assign(candidate, metadata);
      metadataCache.set(cacheKey, { timestamp: Date.now(), metadata });
    })
  );

  return candidates;
}

module.exports = {
  getSpotifyBasedSuggestions,
  getSpotifyRecommendations,
  searchSpotifyTrack,
  getTrackDetails,
  getArtistGenres,
  enrichCandidatesWithSpotifyMetadata,
};
