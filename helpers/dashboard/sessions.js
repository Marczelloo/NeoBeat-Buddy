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
    if (key) out[key] = decodeURIComponent(part.slice(index + 1).trim());
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
