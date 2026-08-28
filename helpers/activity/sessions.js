const sessionsByGuild = new Map();
const recentActivityByGuild = new Map();
const actionLeasesByGuild = new Map();
// A WebSocket can be replaced while Discord moves an Activity between iframe
// states. Keep a very small server-side grace window so a track transition in
// that gap does not resurrect the legacy text-channel player.
const ACTIVITY_SESSION_GRACE_MS = Math.max(5_000, Number(process.env.ACTIVITY_SESSION_GRACE_MS) || 15_000);
// Surprise, imports and provider resolution can take longer than the short
// handoff grace. Keep Activity authoritative while one of its own actions is
// in flight, but expire an abandoned lease rather than suppressing the text
// player forever after a provider stalls.
const ACTIVITY_ACTION_LEASE_MS = Math.max(30_000, Number(process.env.ACTIVITY_ACTION_LEASE_MS) || 90_000);

function sessionKey(guildId) {
  return String(guildId || "");
}

function registerActivitySession(guildId, socket) {
  const key = sessionKey(guildId);
  if (!key || !socket) return;
  if (!sessionsByGuild.has(key)) sessionsByGuild.set(key, new Set());
  sessionsByGuild.get(key).add(socket);
}

function touchActivitySession(guildId, now = Date.now()) {
  const key = sessionKey(guildId);
  if (!key) return;
  recentActivityByGuild.set(key, now + ACTIVITY_SESSION_GRACE_MS);
}

function pruneActionLeases(key, now = Date.now()) {
  const leases = actionLeasesByGuild.get(key);
  if (!leases) return false;
  for (const [token, expiresAt] of leases) {
    if (expiresAt <= now) leases.delete(token);
  }
  if (!leases.size) {
    actionLeasesByGuild.delete(key);
    return false;
  }
  return true;
}

function beginActivityAction(guildId, now = Date.now()) {
  const key = sessionKey(guildId);
  if (!key) return () => {};

  const token = Symbol("activity-action");
  if (!actionLeasesByGuild.has(key)) actionLeasesByGuild.set(key, new Map());
  actionLeasesByGuild.get(key).set(token, now + ACTIVITY_ACTION_LEASE_MS);
  touchActivitySession(key, now);

  let released = false;
  return (releasedAt = Date.now()) => {
    if (released) return;
    released = true;
    const leases = actionLeasesByGuild.get(key);
    leases?.delete(token);
    if (leases && !leases.size) actionLeasesByGuild.delete(key);
    // Preserve the normal short handoff window after the request resolves.
    touchActivitySession(key, releasedAt);
  };
}

function unregisterActivitySession(guildId, socket) {
  const key = sessionKey(guildId);
  const sessions = sessionsByGuild.get(key);
  if (!sessions) return;
  sessions.delete(socket);
  if (!sessions.size) sessionsByGuild.delete(key);
}

function hasActiveActivitySession(guildId, now = Date.now()) {
  const key = sessionKey(guildId);
  if (!key) return false;
  if (sessionsByGuild.get(key)?.size) return true;
  if (pruneActionLeases(key, now)) return true;

  const expiresAt = recentActivityByGuild.get(key);
  if (!expiresAt || expiresAt <= now) {
    recentActivityByGuild.delete(key);
    return false;
  }
  return true;
}

function resetActivitySessions() {
  sessionsByGuild.clear();
  recentActivityByGuild.clear();
  actionLeasesByGuild.clear();
}

module.exports = {
  registerActivitySession,
  unregisterActivitySession,
  touchActivitySession,
  beginActivityAction,
  hasActiveActivitySession,
  resetActivitySessions,
};
