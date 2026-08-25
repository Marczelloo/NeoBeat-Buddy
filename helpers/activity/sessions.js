const sessionsByGuild = new Map();

function sessionKey(guildId) {
  return String(guildId || "");
}

function registerActivitySession(guildId, socket) {
  const key = sessionKey(guildId);
  if (!key || !socket) return;
  if (!sessionsByGuild.has(key)) sessionsByGuild.set(key, new Set());
  sessionsByGuild.get(key).add(socket);
}

function unregisterActivitySession(guildId, socket) {
  const key = sessionKey(guildId);
  const sessions = sessionsByGuild.get(key);
  if (!sessions) return;
  sessions.delete(socket);
  if (!sessions.size) sessionsByGuild.delete(key);
}

function hasActiveActivitySession(guildId) {
  return Boolean(sessionsByGuild.get(sessionKey(guildId))?.size);
}

function resetActivitySessions() {
  sessionsByGuild.clear();
}

module.exports = {
  registerActivitySession,
  unregisterActivitySession,
  hasActiveActivitySession,
  resetActivitySessions,
};
