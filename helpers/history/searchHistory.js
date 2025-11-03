const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "../data/searchHistory.json");
const MAX_HISTORY_PER_USER = 100; // Keep last 100 searches per user

/**
 * Load search history from file
 * @returns {Object} Search history data
 */
function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      const initialData = {};
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load search history:", err);
    return {};
  }
}

/**
 * Save search history to file
 * @param {Object} data - History data to save
 */
function saveHistory(data) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save search history:", err);
    throw err;
  }
}

/**
 * Record a search query and result
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {string} query - Search query
 * @param {Object} track - Track that was played
 */
function recordSearch(userId, guildId, query, track) {
  if (!userId || !track) return;

  const data = loadHistory();

  if (!data[userId]) {
    data[userId] = [];
  }

  const entry = {
    query,
    track: {
      title: track.info?.title || track.title,
      author: track.info?.author || track.author,
      identifier: track.info?.identifier || track.identifier,
      uri: track.info?.uri || track.uri,
      length: track.info?.length || track.length,
      sourceName: track.info?.sourceName || "unknown",
    },
    guildId,
    timestamp: Date.now(),
  };

  data[userId].unshift(entry);

  // Keep only last MAX_HISTORY_PER_USER searches
  if (data[userId].length > MAX_HISTORY_PER_USER) {
    data[userId] = data[userId].slice(0, MAX_HISTORY_PER_USER);
  }

  saveHistory(data);
}

/**
 * Get search history for a user
 * @param {string} userId - User ID
 * @param {string} guildId - Optional guild filter
 * @param {number} limit - Max entries to return
 * @returns {Array} Search history entries
 */
function getHistory(userId, guildId = null, limit = 50) {
  const data = loadHistory();

  if (!data[userId] || !Array.isArray(data[userId])) {
    return [];
  }

  let history = data[userId];

  // Filter by guild if specified
  if (guildId) {
    history = history.filter((entry) => entry.guildId === guildId);
  }

  return history.slice(0, limit);
}

/**
 * Clear search history for a user
 * @param {string} userId - User ID
 * @param {string} guildId - Optional guild filter (only clear guild history)
 * @returns {Object} Result
 */
function clearHistory(userId, guildId = null) {
  const data = loadHistory();

  if (!data[userId]) {
    return { success: false, error: "No search history found." };
  }

  if (guildId) {
    // Only clear history for specific guild
    const beforeCount = data[userId].length;
    data[userId] = data[userId].filter((entry) => entry.guildId !== guildId);
    const clearedCount = beforeCount - data[userId].length;

    if (clearedCount === 0) {
      return { success: false, error: "No search history found for this server." };
    }

    saveHistory(data);
    return { success: true, message: `Cleared ${clearedCount} search entries from this server.` };
  } else {
    // Clear all history for user
    const count = data[userId].length;
    delete data[userId];
    saveHistory(data);
    return { success: true, message: `Cleared ${count} search entries.` };
  }
}

/**
 * Search within history
 * @param {string} userId - User ID
 * @param {string} searchQuery - Query to search for
 * @param {number} limit - Max results
 * @returns {Array} Matching history entries
 */
function searchHistory(userId, searchQuery, limit = 25) {
  const data = loadHistory();

  if (!data[userId]) {
    return [];
  }

  const query = searchQuery.toLowerCase();

  return data[userId]
    .filter((entry) => {
      const title = entry.track.title.toLowerCase();
      const author = entry.track.author.toLowerCase();
      const originalQuery = entry.query.toLowerCase();

      return title.includes(query) || author.includes(query) || originalQuery.includes(query);
    })
    .slice(0, limit);
}

module.exports = {
  recordSearch,
  getHistory,
  clearHistory,
  searchHistory,
};
