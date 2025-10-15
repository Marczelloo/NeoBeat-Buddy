const Log = require("../logs/log");
const {
  searchSpotifyTrack,
  getTrackDetails,
  getArtistGenres,
  getAudioFeatures,
  fetchSpotifyRecommendations,
} = require("./spotifyClient");

/**
 * Gets Spotify-based recommendations with enhanced metadata
 * @param {string} seedTrackId - Spotify seed track ID
 * @param {number} limit - Number of recommendations
 * @param {Array<string>} targetGenres - Target genres
 * @param {Object} targetFeatures - Target audio features
 * @returns {Promise<Array>} Enriched recommendations with genres and features
 */
async function getSpotifyRecommendations(seedTrackId, limit = 10, targetGenres = [], targetFeatures = null) {
  const recommendations = await fetchSpotifyRecommendations(seedTrackId, limit, targetGenres, targetFeatures);
  if (recommendations.length === 0) return [];

  const artistIds = recommendations.flatMap((track) => track.artists.map((a) => a.id));
  const artistGenresMap = new Map();

  if (artistIds.length > 0) {
    const uniqueArtistIds = [...new Set(artistIds)];
    const artistGenres = await getArtistGenres(uniqueArtistIds);

    uniqueArtistIds.forEach((artistId) => {
      artistGenresMap.set(artistId, artistGenres);
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

  return recommendations.map((track) => {
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
}

/**
 * Gets Spotify-based suggestions from a reference track
 * @param {Object} referenceTrack - Reference track to base recommendations on
 * @returns {Promise<Array>} Enriched recommendations
 */
async function getSpotifyBasedSuggestions(referenceTrack) {
  if (!referenceTrack?.info) return [];

  const { title, author } = referenceTrack.info;

  const trackId = await searchSpotifyTrack(title, author);

  if (!trackId) {
    Log.warning("Could not find reference track on Spotify", "", `title=${title}`, `artist=${author}`);
    return [];
  }

  const recommendations = await getSpotifyRecommendations(trackId, 5);

  return recommendations;
}

module.exports = {
  getSpotifyBasedSuggestions,
  getSpotifyRecommendations,
  searchSpotifyTrack,
  getTrackDetails,
  getArtistGenres,
};
