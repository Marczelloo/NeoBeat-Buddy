const { randomBytes } = require("node:crypto");

const SESSION_COOKIE = "mewbit_dash";
const STATE_COOKIE = "mewbit_dash_state";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 5_000;

const sessions = new Map();

function defaultTtlMs() {
  const parsed = Number(process.env.DASHBOARD_SESSION_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

function createSession(data, { ttlMs } = {}) {
  const id = randomBytes(32).toString("hex");
  const lifetime = Number.isFinite(ttlMs) ? ttlMs : defaultTtlMs();
  sessions.set(id, { ...data, createdAt: Date.now(), expiresAt: Date.now() + lifetime });

  // Expired entries are otherwise only dropped when someone happens to present
  // them, so they can occupy the cap indefinitely. Clear those first; evicting
  // by insertion order alone would sign out the longest-running admin to make
  // room for a session that is already dead.
  if (sessions.size > MAX_SESSIONS) {
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(key);
    }
  }
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  return id;
}

function getSession(id) {
  if (!id || typeof id !== "string") return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

function destroySession(id) {
  if (typeof id === "string") sessions.delete(id);
}

function resetSessions() {
  sessions.clear();
}

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    const raw = part.slice(index + 1).trim();
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      // A cookie like `mewbit_dash=%` is a URIError, and anyone can set one on
      // their own browser. Keep the raw value: it will simply not match a
      // session, which is a clean 401 rather than a logged 500.
      out[key] = raw;
    }
  }
  return out;
}

function serializeCookie(name, value, { secure, maxAgeMs }) {
  const attributes = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(Math.max(0, maxAgeMs) / 1000)}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function serializeSessionCookie(id, options) {
  return serializeCookie(SESSION_COOKIE, id, options);
}

function serializeStateCookie(state, options) {
  return serializeCookie(STATE_COOKIE, state, options);
}

function serializeClearCookie({ secure, name = SESSION_COOKIE } = {}) {
  return serializeCookie(name, "", { secure, maxAgeMs: 0 });
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  resetSessions,
  parseCookies,
  serializeSessionCookie,
  serializeStateCookie,
  serializeClearCookie,
  SESSION_COOKIE,
  STATE_COOKIE,
};
