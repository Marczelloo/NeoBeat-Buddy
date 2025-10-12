const Log = require("../logs/log");

const pendingUpdates = new Map();
const THROTTLE_DELAY = 200;

function throttleEqUpdate(guildId, updateFn) {
  if (pendingUpdates.has(guildId)) {
    clearTimeout(pendingUpdates.get(guildId));
  }

  const timeoutId = setTimeout(async () => {
    try {
      await updateFn();
      pendingUpdates.delete(guildId);
    } catch (err) {
      Log.error("Failed to apply throttled EQ update", err, `guild=${guildId}`);
      pendingUpdates.delete(guildId);
    }
  }, THROTTLE_DELAY);

  pendingUpdates.set(guildId, timeoutId);
}

function clearPendingUpdates(guildId) {
  if (pendingUpdates.has(guildId)) {
    clearTimeout(pendingUpdates.get(guildId));
    pendingUpdates.delete(guildId);
  }
}

module.exports = {
  throttleEqUpdate,
  clearPendingUpdates,
};
