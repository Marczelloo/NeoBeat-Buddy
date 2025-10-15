const Log = require("../logs/log");
const { genreCache } = require("./sessionProfile");

const skipHistory = new Map();

/**
 * Gets skip patterns from recent history
 * @param {string} guildId - Guild identifier
 * @returns {Object} Skip patterns including artists and genres
 */
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

/**
 * Records a skip for learning user preferences
 * @param {string} guildId - Guild identifier
 * @param {Object} track - Track that was skipped
 * @param {string} reason - Reason for skip (manual, timeout, etc.)
 */
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

module.exports = {
  getSkipPatterns,
  recordSkip,
  skipHistory,
};
