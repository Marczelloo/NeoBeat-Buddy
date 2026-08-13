const { EventEmitter } = require("node:events");

const activityStateEvents = new EventEmitter();
const revisions = new Map();

function getActivityStateRevision(guildId) {
  return revisions.get(String(guildId || "")) || 0;
}

function markActivityStateChanged(guildId, reason = "update") {
  const key = String(guildId || "");
  if (!key) return 0;

  const revision = getActivityStateRevision(key) + 1;
  revisions.set(key, revision);
  activityStateEvents.emit("change", { guildId: key, reason, revision });
  return revision;
}

function resetActivityStateRevision(guildId) {
  revisions.delete(String(guildId || ""));
}

module.exports = {
  activityStateEvents,
  getActivityStateRevision,
  markActivityStateChanged,
  resetActivityStateRevision,
};
