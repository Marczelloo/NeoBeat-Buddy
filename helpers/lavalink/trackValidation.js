const Log = require("../logs/log");

/**
 * Validates if a track is likely a real song (not a short clip, tutorial, etc.)
 * @param {Object} trackInfo - Track information
 * @param {Object} options - Validation options
 * @param {boolean} options.allowStreams - Allow live streams (default: true)
 * @param {boolean} options.strictDuration - Enforce strict duration limits (default: false)
 */
function isValidSong(trackInfo, options = {}) {
  if (!trackInfo) return false;

  const { allowStreams = true, strictDuration = false } = options;
  const { title, author, length, isStream } = trackInfo;

  // Allow streams by default (user can manually add them)
  if (isStream && !allowStreams) {
    Log.warning("Track validation failed: is a stream", "", `title=${title}`);
    return false;
  }

  // Skip duration check for streams
  if (!isStream) {
    // Duration checks (in milliseconds)
    const MIN_DURATION = 30 * 1000; // 30 seconds

    if (length < MIN_DURATION) {
      Log.warning("Track validation failed: too short", "", `title=${title}`, `duration=${Math.floor(length / 1000)}s`);
      return false;
    }

    // Only enforce max duration if strictDuration is enabled
    if (strictDuration) {
      const MAX_DURATION = 20 * 60 * 1000; // 20 minutes
      if (length > MAX_DURATION) {
        Log.warning(
          "Track validation failed: too long",
          "",
          `title=${title}`,
          `duration=${Math.floor(length / 1000)}s`
        );
        return false;
      }
    }
  }

  // Filter out common non-song indicators in title (case insensitive)
  const titleLower = (title || "").toLowerCase();
  const blacklistedKeywords = [
    "tutorial",
    "how to",
    "lesson",
    "interview",
    "review",
    "reaction",
    "explained",
    "trailer",
    "teaser",
    "behind the scenes",
    "making of",
    "podcast",
    "talk show",
    "news",
    "full album",
    "entire album",
    // Poetry/spoken word specific
    "poetry",
    "poem",
    "@wanpoetry",
    "spoken word",
    "motivational speech",
    "quotes",
    "#poetry",
    // Social media specific (usually not music)
    "search for",
    "full vid on yt",
    "check out",
    "link in bio",
    "#ytsearch",
    "#ytshorts",
    // Memes/viral content
    "#shorts",
    "#viral",
    "#trending",
    "#fyp",
  ];

  for (const keyword of blacklistedKeywords) {
    if (titleLower.includes(keyword)) {
      Log.warning("Track validation failed: blacklisted keyword", "", `title=${title}`, `keyword=${keyword}`);
      return false;
    }
  }

  // Filter out titles with excessive hashtags or emojis (usually not real music)
  const hashtagCount = (title.match(/#/g) || []).length;
  if (hashtagCount > 3) {
    Log.warning("Track validation failed: excessive hashtags", "", `title=${title}`, `count=${hashtagCount}`);
    return false;
  }

  // Filter out author/channel names that indicate non-music content
  const authorLower = (author || "").toLowerCase();
  const blacklistedChannels = [
    "tutorial",
    "lesson",
    "podcast network",
    "news channel",
    "radio show",
    "write about now", // The poetry channel from your logs
    "poetry",
    "spoken word",
    "motivational",
  ];

  const isSuspiciousChannel = blacklistedChannels.some((keyword) => authorLower.includes(keyword));

  if (isSuspiciousChannel) {
    Log.warning("Track validation failed: suspicious channel", "", `title=${title}`, `author=${author}`);
    return false;
  }

  // Additional check: prefer official music channels/topics
  const hasOfficialIndicators =
    titleLower.includes("official") ||
    titleLower.includes("music video") ||
    titleLower.includes("official video") ||
    titleLower.includes("official audio") ||
    titleLower.includes("lyric video") ||
    titleLower.includes("lyrics") ||
    authorLower.includes("vevo") ||
    authorLower.includes("official") ||
    authorLower.includes(" - topic"); // YouTube auto-generated artist channels

  // If track has excessive special characters and no official indicators, it's suspicious
  const specialCharPattern = /[@#🎀🗿🕷✨💫]/g;
  const specialCharCount = (title.match(specialCharPattern) || []).length;

  if (specialCharCount > 2 && !hasOfficialIndicators) {
    Log.warning(
      "Track validation failed: excessive special characters without official indicators",
      "",
      `title=${title}`,
      `specialChars=${specialCharCount}`
    );
    return false;
  }

  return true;
}

/**
 * Filter an array of tracks to only include valid songs
 * @param {Array} tracks - Array of tracks to filter
 * @param {Object} options - Validation options (passed to isValidSong)
 */
function filterValidSongs(tracks, options = {}) {
  return tracks.filter((track) => isValidSong(track.info, options));
}

module.exports = {
  isValidSong,
  filterValidSongs,
};
