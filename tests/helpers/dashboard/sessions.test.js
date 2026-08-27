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
