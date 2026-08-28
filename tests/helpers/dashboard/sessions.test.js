const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createSession,
  getSession,
  destroySession,
  resetSessions,
  parseCookies,
  serializeSessionCookie,
  serializeClearCookie,
  SESSION_COOKIE,
} = require("../../../helpers/dashboard/sessions");

test("a created session is retrievable by its id", () => {
  resetSessions();
  const id = createSession({ userId: "1", username: "Neko", accessToken: "tok", guilds: [] });
  assert.equal(typeof id, "string");
  assert.ok(id.length >= 32);
  assert.equal(getSession(id).userId, "1");
});

test("session ids are unique per creation", () => {
  resetSessions();
  const a = createSession({ userId: "1", accessToken: "t", guilds: [] });
  const b = createSession({ userId: "1", accessToken: "t", guilds: [] });
  assert.notEqual(a, b);
});

test("an expired session reads as absent and is evicted", () => {
  resetSessions();
  const id = createSession({ userId: "1", accessToken: "t", guilds: [] }, { ttlMs: -1 });
  assert.equal(getSession(id), null);
});

test("destroying a session removes it", () => {
  resetSessions();
  const id = createSession({ userId: "1", accessToken: "t", guilds: [] });
  destroySession(id);
  assert.equal(getSession(id), null);
});

test("getSession returns null for unknown ids", () => {
  resetSessions();
  assert.equal(getSession("nope"), null);
  assert.equal(getSession(undefined), null);
});

test("cookies parse into a plain object and tolerate absent headers", () => {
  assert.deepEqual(parseCookies("a=1; b=two"), { a: "1", b: "two" });
  assert.deepEqual(parseCookies(""), {});
  assert.deepEqual(parseCookies(undefined), {});
});

test("the session cookie is httpOnly, lax, and scoped to the site root", () => {
  const cookie = serializeSessionCookie("abc", { secure: true, maxAgeMs: 1000 });
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=abc;`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=1/);
});

test("an insecure deployment omits the Secure attribute", () => {
  assert.doesNotMatch(serializeSessionCookie("abc", { secure: false, maxAgeMs: 1000 }), /Secure/);
});

test("the clear cookie expires immediately", () => {
  assert.match(serializeClearCookie({ secure: true }), /Max-Age=0/);
});

test("a malformed cookie is not a 500 — it simply matches no session", () => {
  // Anyone can set `mewbit_dash=%` on their own browser; decodeURIComponent
  // throws URIError on it, which used to propagate out of requireSession.
  const cookies = parseCookies("mewbit_dash=%; other=%E0%A4%A; fine=ok");
  assert.equal(cookies.fine, "ok");
  assert.equal(cookies.mewbit_dash, "%");
  assert.equal(getSession(cookies.mewbit_dash), null);
});

test("the session cap evicts dead sessions before live ones", () => {
  resetSessions();

  // Oldest by insertion order, and still valid. Evicting purely by insertion
  // order would sign this admin out to make room for sessions already dead.
  const veteran = createSession({ userId: "veteran" });
  for (let i = 0; i < 5000; i += 1) createSession({ userId: `dead-${i}` }, { ttlMs: 0 });

  assert.equal(getSession(veteran)?.userId, "veteran");
});
