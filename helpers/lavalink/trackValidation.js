const Log = require("../logs/log");

function isValidSong(trackInfo, options = {}) {
  if (!trackInfo) return false;

  const { allowStreams = true, strictDuration = false } = options;
  const { title, author, length, isStream } = trackInfo;

  if (isStream && !allowStreams) {
    Log.warning("Track validation failed: is a stream", "", `title=${title}`);
    return false;
  }

  if (!isStream) {
    const MIN_DURATION = 30 * 1000; // 30 seconds

    if (length < MIN_DURATION) {
      Log.warning("Track validation failed: too short", "", `title=${title}`, `duration=${Math.floor(length / 1000)}s`);
      return false;
    }

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

  const hashtagCount = (title.match(/#/g) || []).length;
  if (hashtagCount > 3) {
    Log.warning("Track validation failed: excessive hashtags", "", `title=${title}`, `count=${hashtagCount}`);
    return false;
  }

  const authorLower = (author || "").toLowerCase();
  const blacklistedChannels = [
    "tutorial",
    "lesson",
    "podcast network",
    "news channel",
    "radio show",
    "write about now",
    "poetry",
    "spoken word",
    "motivational",
  ];

  const isSuspiciousChannel = blacklistedChannels.some((keyword) => authorLower.includes(keyword));

  if (isSuspiciousChannel) {
    Log.warning("Track validation failed: suspicious channel", "", `title=${title}`, `author=${author}`);
    return false;
  }

  const hasOfficialIndicators =
    titleLower.includes("official") ||
    titleLower.includes("music video") ||
    titleLower.includes("official video") ||
    titleLower.includes("official audio") ||
    titleLower.includes("lyric video") ||
    titleLower.includes("lyrics") ||
    authorLower.includes("vevo") ||
    authorLower.includes("official") ||
    authorLower.includes(" - topic");

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

function filterValidSongs(tracks, options = {}) {
  return tracks.filter((track) => isValidSong(track.info, options));
}

module.exports = {
  isValidSong,
  filterValidSongs,
};
