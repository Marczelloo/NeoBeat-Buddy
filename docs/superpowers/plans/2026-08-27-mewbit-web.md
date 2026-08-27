# MewBit Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public landing page and an authenticated per-server settings dashboard for the MewBit Discord music bot, backed by a real Discord OAuth2 web flow.

**Architecture:** A new `web/` Vite app holds both surfaces. A new `helpers/dashboard/` module holds OAuth, sessions, permission checks, and a settings projection; the existing Activity gateway in `helpers/activity/server.js` delegates any `/api/dashboard/*` request to it. All settings writes route through the existing `guildState` and `djStore` functions so the dashboard and the slash commands cannot diverge.

**Tech Stack:** Node.js 20 (CommonJS) + `node:http` + discord.js on the backend; React 19 + Vite 8 + `react-router-dom` + `motion` v13 on the frontend. Tests are `node --test` with `node:assert/strict`.

**Spec:** [docs/superpowers/specs/2026-08-27-mewbit-web-design.md](../specs/2026-08-27-mewbit-web-design.md)

## Global Constraints

- Backend files are **CommonJS** (`require`/`module.exports`). The repo has no ESM in `helpers/`.
- Node `>=20`, pnpm `>=10`. Package manager is `pnpm@10.15.0`.
- Frontend pins match `activity/package.json`: React `^19.2.8`, Vite `^8.2.1`, `motion` `^13.0.0`, `@phosphor-icons/react` `^2.1.10`.
- **Never write `helpers/data/*.json` directly.** Guild settings are written only via `updateGuildState()` and `djStore.setGuildConfig()`.
- **Never send the bot token, client secret, or a Discord access token to the browser.** The browser receives only an opaque session id in an httpOnly cookie.
- **Authorization is re-verified server-side on every guild-scoped request** via `guild.members.fetch()`. The OAuth guild list renders the rail and never authorizes a write.
- Obsidian design tokens are binding and copied verbatim from `activity/redesigns/obsidian-brandboard.html`: `--bg:#050608`, `--surface:#0c0e12`, `--raised:#111318`, `--high:#161920`, `--line:rgba(255,255,255,.06)`, `--line-strong:rgba(255,255,255,.12)`, `--text:#f4f6f9`, `--muted-strong:#c3cbd7`, `--muted:#9ba4b2`, `--faint:#667081`, `--accent:#67e3f4`, `--live:#ff6ec7`, `--auto:#a78bfa`, `--danger:#ff8098`, `--white-btn:#f4f6f9`, `--on-white:#0a0c10`.
- Fonts: Hanken Grotesk (UI) + JetBrains Mono (data only). No other families.
- Global easing `cubic-bezier(.32,.72,0,1)`. Micro 140–160ms, views 220–280ms, drawers 320ms.
- Color carries meaning only: cyan = live/focus, magenta = like, violet = autoplay provenance, danger = destructive. No decorative color, no gradient text, no glow shadows.
- `prefers-reduced-motion` disables all looping and transition-heavy effects on both surfaces.
- No fabricated metrics, testimonials, customers, or benchmarks anywhere.

**Frontend testing note:** this repo has no frontend test runner and this plan does not add one. Backend tasks (1–6) are strict TDD. Frontend tasks (7–12) are verified by `pnpm --dir web build` succeeding, `pnpm lint` passing, and browser inspection — stated explicitly per task rather than pretending to a red/green cycle.

---

## File Structure

**Backend — created**

| File | Responsibility |
|---|---|
| `helpers/dashboard/sessions.js` | Server-side session store, TTL, cookie serialize/parse |
| `helpers/dashboard/permissions.js` | Admin detection from OAuth payload; live re-verification |
| `helpers/dashboard/settings.js` | Read/write projection over `guildState` + `djStore`, with validation |
| `helpers/dashboard/oauth.js` | Config, authorize URL, code exchange, user/guild fetches |
| `helpers/dashboard/routes.js` | HTTP router for `/api/dashboard/*` |

**Backend — modified**

| File | Change |
|---|---|
| `helpers/activity/server.js` | Delegate `/api/dashboard/*` to the dashboard router |
| `.env-example` | Document the four new variables |

**Frontend — created**

| File | Responsibility |
|---|---|
| `web/package.json`, `web/vite.config.js`, `web/index.html` | App scaffold |
| `web/src/main.jsx`, `web/src/App.jsx` | Entry and routing |
| `web/src/tokens.css` | Obsidian tokens + base element styles |
| `web/src/api.js` | fetch wrapper with `credentials: "include"` |
| `web/src/landing/*` | Command Palette landing surface |
| `web/src/dashboard/*` | Server Rail dashboard surface |

**Tests — created**

`tests/helpers/dashboard/{sessions,permissions,settings,oauth,routes}.test.js`

---

## Task 1: Session store

**Files:**
- Create: `helpers/dashboard/sessions.js`
- Test: `tests/helpers/dashboard/sessions.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createSession(data) -> string`, `getSession(id) -> object|null`, `destroySession(id) -> void`, `resetSessions() -> void`, `parseCookies(header) -> object`, `serializeSessionCookie(id, opts) -> string`, `serializeClearCookie(opts) -> string`, `SESSION_COOKIE`, `STATE_COOKIE`.

- [ ] **Step 1: Write the failing test**

```js
// tests/helpers/dashboard/sessions.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/helpers/dashboard/sessions.test.js`
Expected: FAIL — `Cannot find module '../../../helpers/dashboard/sessions'`

- [ ] **Step 3: Write minimal implementation**

```js
// helpers/dashboard/sessions.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/helpers/dashboard/sessions.test.js`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add helpers/dashboard/sessions.js tests/helpers/dashboard/sessions.test.js
git commit -m "feat(dashboard): add server-side session store with TTL and cookie helpers"
```

---

## Task 2: Permission checks

**Files:**
- Create: `helpers/dashboard/permissions.js`
- Test: `tests/helpers/dashboard/permissions.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `hasAdminFromOauthGuild(guild) -> boolean`, `listManageableGuilds(client, oauthGuilds) -> Array<{id,name,icon}>`, `assertGuildAdmin(client, guildId, userId) -> Promise<member>`, `ADMINISTRATOR_FLAG`.

- [ ] **Step 1: Write the failing test**

```js
// tests/helpers/dashboard/permissions.test.js
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hasAdminFromOauthGuild,
  listManageableGuilds,
  assertGuildAdmin,
} = require("../../../helpers/dashboard/permissions");

const ADMIN = "8";
const NOT_ADMIN = "2048";

function fakeClient(guilds) {
  return { guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) } };
}

test("the Administrator bit grants access", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: ADMIN }), true);
});

test("a non-administrator permission set does not grant access", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: NOT_ADMIN }), false);
});

test("guild ownership grants access regardless of the permission bits", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: NOT_ADMIN, owner: true }), true);
});

test("a malformed permissions value is denied rather than throwing", () => {
  assert.equal(hasAdminFromOauthGuild({ permissions: "not-a-number" }), false);
  assert.equal(hasAdminFromOauthGuild({}), false);
  assert.equal(hasAdminFromOauthGuild(null), false);
});

test("the guild list is the intersection of administered guilds and bot guilds", () => {
  const client = fakeClient([
    { id: "1", name: "Live One", iconURL: () => "icon-1" },
    { id: "3", name: "Live Three", iconURL: () => null },
  ]);
  const result = listManageableGuilds(client, [
    { id: "1", name: "Admin Here", permissions: ADMIN },
    { id: "2", name: "Admin But Bot Absent", permissions: ADMIN },
    { id: "3", name: "Not Admin", permissions: NOT_ADMIN },
  ]);
  assert.deepEqual(result.map((guild) => guild.id), ["1"]);
  assert.equal(result[0].name, "Live One");
  assert.equal(result[0].icon, "icon-1");
});

test("assertGuildAdmin returns the member when they hold Administrator", async () => {
  const member = { id: "u1", permissions: { has: () => true } };
  const client = fakeClient([{ id: "g1", ownerId: "other", members: { fetch: async () => member } }]);
  assert.equal(await assertGuildAdmin(client, "g1", "u1"), member);
});

test("assertGuildAdmin accepts the guild owner without the Administrator bit", async () => {
  const member = { id: "u1", permissions: { has: () => false } };
  const client = fakeClient([{ id: "g1", ownerId: "u1", members: { fetch: async () => member } }]);
  assert.equal(await assertGuildAdmin(client, "g1", "u1"), member);
});

test("assertGuildAdmin rejects a non-administrator with 403", async () => {
  const member = { id: "u1", permissions: { has: () => false } };
  const client = fakeClient([{ id: "g1", ownerId: "other", members: { fetch: async () => member } }]);
  await assert.rejects(() => assertGuildAdmin(client, "g1", "u1"), (error) => error.statusCode === 403);
});

test("assertGuildAdmin rejects with 404 when the bot is not in the guild", async () => {
  await assert.rejects(
    () => assertGuildAdmin(fakeClient([]), "missing", "u1"),
    (error) => error.statusCode === 404
  );
});

test("assertGuildAdmin rejects with 403 when the user is not a member", async () => {
  const client = fakeClient([{
    id: "g1",
    ownerId: "other",
    members: { fetch: async () => { throw new Error("Unknown Member"); } },
  }]);
  await assert.rejects(() => assertGuildAdmin(client, "g1", "u1"), (error) => error.statusCode === 403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/helpers/dashboard/permissions.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```js
// helpers/dashboard/permissions.js
const { PermissionsBitField } = require("discord.js");

const ADMINISTRATOR_FLAG = 0x8n;

function hasAdminFromOauthGuild(guild) {
  if (!guild || typeof guild !== "object") return false;
  if (guild.owner === true) return true;
  try {
    return (BigInt(guild.permissions ?? 0) & ADMINISTRATOR_FLAG) === ADMINISTRATOR_FLAG;
  } catch {
    return false;
  }
}

function listManageableGuilds(client, oauthGuilds = []) {
  const results = [];
  for (const oauthGuild of oauthGuilds) {
    if (!hasAdminFromOauthGuild(oauthGuild)) continue;
    const live = client?.guilds?.cache?.get(oauthGuild.id);
    if (!live) continue;
    results.push({
      id: oauthGuild.id,
      name: live.name || oauthGuild.name || "Unknown server",
      icon: typeof live.iconURL === "function" ? live.iconURL({ size: 128 }) : null,
    });
  }
  return results;
}

async function assertGuildAdmin(client, guildId, userId) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) {
    throw Object.assign(new Error("MewBit is not in this server."), { statusCode: 404 });
  }

  let member;
  try {
    member = await guild.members.fetch(userId);
  } catch {
    throw Object.assign(new Error("You are not a member of this server."), { statusCode: 403 });
  }

  if (guild.ownerId === userId) return member;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return member;

  throw Object.assign(new Error("You need Administrator permission in this server."), { statusCode: 403 });
}

module.exports = { hasAdminFromOauthGuild, listManageableGuilds, assertGuildAdmin, ADMINISTRATOR_FLAG };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/helpers/dashboard/permissions.test.js`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add helpers/dashboard/permissions.js tests/helpers/dashboard/permissions.test.js
git commit -m "feat(dashboard): verify server administrator permission against the live client"
```

---

## Task 3: Settings projection

**Files:**
- Create: `helpers/dashboard/settings.js`
- Test: `tests/helpers/dashboard/settings.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `readGuildSettings(client, guildId) -> object`, `applyGuildSettings(guildId, patch) -> object`, `SOURCES`, `SKIP_MODES`.

The returned settings shape, relied on verbatim by Tasks 5, 10 and 11:

```js
{
  player: { playerChannel: string|null, autoplay: boolean, radio247: boolean },
  source: { defaultSource: "deezer"|"youtube"|"spotify"|"soundcloud" },
  announcements: { announcementChannel: string|null, announcementsEnabled: boolean },
  dj: { enabled: boolean, roleId: string|null, skipMode: "dj"|"vote"|"hybrid", voteThreshold: number, strictMode: boolean },
  options: { channels: [{ id, name }], roles: [{ id, name }] }
}
```

- [ ] **Step 1: Write the failing test**

```js
// tests/helpers/dashboard/settings.test.js
const assert = require("node:assert/strict");
const test = require("node:test");
const djStore = require("../../../helpers/dj/store");
const { resetGuildState, getGuildState } = require("../../../helpers/guildState");
const { readGuildSettings, applyGuildSettings } = require("../../../helpers/dashboard/settings");

const GUILD = "settings-test-guild";

function fakeClient() {
  return {
    guilds: {
      cache: new Map([[GUILD, {
        id: GUILD,
        channels: { cache: new Map([["c1", { id: "c1", name: "music", type: 0 }]]) },
        roles: { cache: new Map([["r1", { id: "r1", name: "DJ", managed: false }]]) },
      }]]),
    },
  };
}

test("settings read back the current store values and the picker options", () => {
  resetGuildState(GUILD);
  djStore.setGuildConfig(GUILD, { enabled: false, roleId: null, skipMode: "vote", voteThreshold: 0.5, strictMode: false });

  const settings = readGuildSettings(fakeClient(), GUILD);
  assert.equal(settings.source.defaultSource, "deezer");
  assert.equal(settings.player.autoplay, false);
  assert.equal(settings.dj.skipMode, "vote");
  assert.deepEqual(settings.options.channels, [{ id: "c1", name: "music" }]);
  assert.deepEqual(settings.options.roles, [{ id: "r1", name: "DJ" }]);
});

test("applying player settings writes through guildState", () => {
  resetGuildState(GUILD);
  applyGuildSettings(GUILD, { player: { playerChannel: "c1", autoplay: true, radio247: true } });
  const state = getGuildState(GUILD);
  assert.equal(state.playerChannel, "c1");
  assert.equal(state.autoplay, true);
  assert.equal(state.radio247, true);
});

test("a null player channel clears the setting", () => {
  resetGuildState(GUILD);
  applyGuildSettings(GUILD, { player: { playerChannel: "c1" } });
  applyGuildSettings(GUILD, { player: { playerChannel: null } });
  assert.equal(getGuildState(GUILD).playerChannel, null);
});

test("an unknown search source is rejected with 400", () => {
  resetGuildState(GUILD);
  assert.throws(
    () => applyGuildSettings(GUILD, { source: { defaultSource: "napster" } }),
    (error) => error.statusCode === 400
  );
});

test("every supported search source is accepted", () => {
  resetGuildState(GUILD);
  for (const source of ["deezer", "youtube", "spotify", "soundcloud"]) {
    applyGuildSettings(GUILD, { source: { defaultSource: source } });
    assert.equal(getGuildState(GUILD).defaultSource, source);
  }
});

test("an unknown skip mode is rejected with 400", () => {
  assert.throws(
    () => applyGuildSettings(GUILD, { dj: { skipMode: "coinflip" } }),
    (error) => error.statusCode === 400
  );
});

test("the vote threshold is rejected outside 0.1 to 1.0", () => {
  assert.throws(() => applyGuildSettings(GUILD, { dj: { voteThreshold: 0 } }), (error) => error.statusCode === 400);
  assert.throws(() => applyGuildSettings(GUILD, { dj: { voteThreshold: 1.5 } }), (error) => error.statusCode === 400);
  assert.throws(() => applyGuildSettings(GUILD, { dj: { voteThreshold: "half" } }), (error) => error.statusCode === 400);
});

test("DJ settings write through djStore", () => {
  applyGuildSettings(GUILD, { dj: { enabled: true, roleId: "r1", skipMode: "hybrid", voteThreshold: 0.75, strictMode: true } });
  const config = djStore.getGuildConfig(GUILD);
  assert.equal(config.enabled, true);
  assert.equal(config.roleId, "r1");
  assert.equal(config.skipMode, "hybrid");
  assert.equal(config.voteThreshold, 0.75);
  assert.equal(config.strictMode, true);
});

test("announcement settings write through guildState", () => {
  resetGuildState(GUILD);
  applyGuildSettings(GUILD, { announcements: { announcementChannel: "c1", announcementsEnabled: false } });
  const state = getGuildState(GUILD);
  assert.equal(state.announcementChannel, "c1");
  assert.equal(state.announcementsEnabled, false);
});

test("applying settings returns the full refreshed shape", () => {
  resetGuildState(GUILD);
  const result = applyGuildSettings(GUILD, { player: { autoplay: true } }, fakeClient());
  assert.equal(result.player.autoplay, true);
  assert.ok(result.options);
});

test("an unknown section is ignored rather than throwing", () => {
  resetGuildState(GUILD);
  assert.doesNotThrow(() => applyGuildSettings(GUILD, { nonsense: { x: 1 } }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/helpers/dashboard/settings.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```js
// helpers/dashboard/settings.js
const djStore = require("../dj/store");
const { getGuildState, updateGuildState } = require("../guildState");

const SOURCES = Object.freeze(["deezer", "youtube", "spotify", "soundcloud"]);
const SKIP_MODES = Object.freeze(["dj", "vote", "hybrid"]);
const TEXT_CHANNEL_TYPES = new Set([0, 5]);

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function has(object, key) {
  return object && Object.prototype.hasOwnProperty.call(object, key);
}

function readChannelId(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{5,25}$/.test(value)) throw badRequest(`${label} must be a channel id.`);
  return value;
}

function readBoolean(value, label) {
  if (typeof value !== "boolean") throw badRequest(`${label} must be true or false.`);
  return value;
}

function readOptions(client, guildId) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) return { channels: [], roles: [] };
  const channels = [...(guild.channels?.cache?.values?.() || [])]
    .filter((channel) => TEXT_CHANNEL_TYPES.has(channel.type))
    .map((channel) => ({ id: channel.id, name: channel.name }));
  const roles = [...(guild.roles?.cache?.values?.() || [])]
    .filter((role) => !role.managed && role.name !== "@everyone")
    .map((role) => ({ id: role.id, name: role.name }));
  return { channels, roles };
}

function readGuildSettings(client, guildId) {
  const state = getGuildState(guildId);
  const dj = djStore.getGuildConfig(guildId);
  return {
    player: {
      playerChannel: state.playerChannel ?? null,
      autoplay: Boolean(state.autoplay),
      radio247: Boolean(state.radio247),
    },
    source: { defaultSource: state.defaultSource || "deezer" },
    announcements: {
      announcementChannel: state.announcementChannel ?? null,
      announcementsEnabled: state.announcementsEnabled !== false,
    },
    dj: {
      enabled: Boolean(dj.enabled),
      roleId: dj.roleId ?? null,
      skipMode: dj.skipMode,
      voteThreshold: dj.voteThreshold,
      strictMode: Boolean(dj.strictMode),
    },
    options: readOptions(client, guildId),
  };
}

function applyGuildSettings(guildId, patch = {}, client = null) {
  const stateUpdates = {};

  if (patch.player) {
    if (has(patch.player, "playerChannel")) stateUpdates.playerChannel = readChannelId(patch.player.playerChannel, "Player channel");
    if (has(patch.player, "autoplay")) stateUpdates.autoplay = readBoolean(patch.player.autoplay, "Autoplay");
    if (has(patch.player, "radio247")) stateUpdates.radio247 = readBoolean(patch.player.radio247, "24/7 radio");
  }

  if (patch.source && has(patch.source, "defaultSource")) {
    if (!SOURCES.includes(patch.source.defaultSource)) throw badRequest("Unknown search source.");
    stateUpdates.defaultSource = patch.source.defaultSource;
  }

  if (patch.announcements) {
    if (has(patch.announcements, "announcementChannel")) {
      stateUpdates.announcementChannel = readChannelId(patch.announcements.announcementChannel, "Announcement channel");
    }
    if (has(patch.announcements, "announcementsEnabled")) {
      stateUpdates.announcementsEnabled = readBoolean(patch.announcements.announcementsEnabled, "Announcements");
    }
  }

  if (Object.keys(stateUpdates).length > 0) updateGuildState(guildId, stateUpdates);

  if (patch.dj) {
    const djUpdates = {};
    if (has(patch.dj, "enabled")) djUpdates.enabled = readBoolean(patch.dj.enabled, "DJ mode");
    if (has(patch.dj, "strictMode")) djUpdates.strictMode = readBoolean(patch.dj.strictMode, "Strict mode");
    if (has(patch.dj, "roleId")) {
      const value = patch.dj.roleId;
      if (value !== null && value !== "" && (typeof value !== "string" || !/^\d{5,25}$/.test(value))) {
        throw badRequest("DJ role must be a role id.");
      }
      djUpdates.roleId = value === "" ? null : value;
    }
    if (has(patch.dj, "skipMode")) {
      if (!SKIP_MODES.includes(patch.dj.skipMode)) throw badRequest("Unknown skip mode.");
      djUpdates.skipMode = patch.dj.skipMode;
    }
    if (has(patch.dj, "voteThreshold")) {
      const parsed = Number(patch.dj.voteThreshold);
      if (!Number.isFinite(parsed) || parsed < 0.1 || parsed > 1) throw badRequest("Vote threshold must be between 0.1 and 1.");
      djUpdates.voteThreshold = parsed;
    }
    if (Object.keys(djUpdates).length > 0) djStore.setGuildConfig(guildId, djUpdates);
  }

  return readGuildSettings(client, guildId);
}

module.exports = { readGuildSettings, applyGuildSettings, SOURCES, SKIP_MODES };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/helpers/dashboard/settings.test.js`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add helpers/dashboard/settings.js tests/helpers/dashboard/settings.test.js
git commit -m "feat(dashboard): project guild settings over guildState and djStore with validation"
```

---

## Task 4: OAuth helpers

**Files:**
- Create: `helpers/dashboard/oauth.js`
- Test: `tests/helpers/dashboard/oauth.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getDashboardConfig() -> object`, `buildAuthorizeUrl(state, config) -> string`, `exchangeCode(code, config, fetchImpl) -> Promise<object>`, `fetchOauthUser(token, fetchImpl) -> Promise<object>`, `fetchOauthGuilds(token, fetchImpl) -> Promise<Array>`.

`getDashboardConfig()` returns `{ enabled, publicUrl, redirectUri, clientId, clientSecret, secure }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/helpers/dashboard/oauth.test.js
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getDashboardConfig,
  buildAuthorizeUrl,
  exchangeCode,
  fetchOauthUser,
  fetchOauthGuilds,
} = require("../../../helpers/dashboard/oauth");

function withEnv(values, run) {
  const saved = { ...process.env };
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    process.env = saved;
  }
}

test("the dashboard is enabled by default and reads its public url", () => {
  withEnv({ DASHBOARD_ENABLED: undefined, DASHBOARD_PUBLIC_URL: "https://mewbit.test" }, () => {
    const config = getDashboardConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.publicUrl, "https://mewbit.test");
    assert.equal(config.secure, true);
  });
});

test("an http public url marks the deployment insecure so cookies drop Secure", () => {
  withEnv({ DASHBOARD_PUBLIC_URL: "http://localhost:5174" }, () => {
    assert.equal(getDashboardConfig().secure, false);
  });
});

test("the dashboard can be switched off", () => {
  withEnv({ DASHBOARD_ENABLED: "false" }, () => {
    assert.equal(getDashboardConfig().enabled, false);
  });
});

test("the redirect uri defaults to the public url callback path", () => {
  withEnv({ DASHBOARD_PUBLIC_URL: "https://mewbit.test", DASHBOARD_OAUTH_REDIRECT_URI: undefined }, () => {
    assert.equal(getDashboardConfig().redirectUri, "https://mewbit.test/api/dashboard/callback");
  });
});

test("the authorize url carries the identify and guilds scopes and the state", () => {
  const url = new URL(buildAuthorizeUrl("state-value", {
    clientId: "123",
    redirectUri: "https://mewbit.test/api/dashboard/callback",
  }));
  assert.equal(url.origin + url.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "identify guilds");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.equal(url.searchParams.get("redirect_uri"), "https://mewbit.test/api/dashboard/callback");
});

test("a successful code exchange returns the token payload", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ access_token: "tok" }) });
  const payload = await exchangeCode("code", { clientId: "1", clientSecret: "s", redirectUri: "r" }, fetchImpl);
  assert.equal(payload.access_token, "tok");
});

test("a rejected code exchange throws a 502 without leaking the secret", async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) });
  await assert.rejects(
    () => exchangeCode("bad", { clientId: "1", clientSecret: "super-secret", redirectUri: "r" }, fetchImpl),
    (error) => error.statusCode === 502 && !error.message.includes("super-secret")
  );
});

test("the user fetch returns the identity", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ id: "u1", username: "neko" }) });
  assert.equal((await fetchOauthUser("tok", fetchImpl)).id, "u1");
});

test("an expired token surfaces as 401", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(() => fetchOauthUser("tok", fetchImpl), (error) => error.statusCode === 401);
});

test("the guild fetch always returns an array", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ message: "not a list" }) });
  assert.deepEqual(await fetchOauthGuilds("tok", fetchImpl), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/helpers/dashboard/oauth.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```js
// helpers/dashboard/oauth.js
const DISCORD_API = "https://discord.com/api/v10";

function isFalse(value) {
  return ["0", "false", "off", "no"].includes(String(value ?? "").toLowerCase());
}

function getDashboardConfig() {
  const publicUrl = (process.env.DASHBOARD_PUBLIC_URL || "http://localhost:5174").replace(/\/+$/, "");
  return {
    enabled: !isFalse(process.env.DASHBOARD_ENABLED ?? "true"),
    publicUrl,
    redirectUri: process.env.DASHBOARD_OAUTH_REDIRECT_URI || `${publicUrl}/api/dashboard/callback`,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.ACTIVITY_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET,
    secure: publicUrl.startsWith("https://"),
  };
}

function buildAuthorizeUrl(state, config) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode(code, config, fetchImpl = fetch) {
  const response = await fetchImpl(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error("Discord sign-in failed. Try again."), { statusCode: 502 });
  }
  return payload;
}

async function fetchOauthUser(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Object.assign(new Error("Discord sign-in expired."), { statusCode: 401 });
  return response.json();
}

async function fetchOauthGuilds(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Object.assign(new Error("Discord sign-in expired."), { statusCode: 401 });
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

module.exports = { getDashboardConfig, buildAuthorizeUrl, exchangeCode, fetchOauthUser, fetchOauthGuilds };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/helpers/dashboard/oauth.test.js`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add helpers/dashboard/oauth.js tests/helpers/dashboard/oauth.test.js
git commit -m "feat(dashboard): add Discord OAuth2 web-flow helpers"
```

---

## Task 5: HTTP router and gateway wiring

**Files:**
- Create: `helpers/dashboard/routes.js`
- Modify: `helpers/activity/server.js` (delegate inside `handleRequest`)
- Modify: `.env-example`
- Test: `tests/helpers/dashboard/routes.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `createDashboardRouter(client) -> { handle(request, response, url) -> Promise<boolean> }`. `handle` returns `true` when it owned the request.

Route table implemented here: `GET /api/dashboard/login`, `GET /api/dashboard/callback`, `POST /api/dashboard/logout`, `GET /api/dashboard/me`, `GET /api/dashboard/guilds/:id/settings`, `PATCH /api/dashboard/guilds/:id/settings`. The public stats route is added in Task 6.

- [ ] **Step 1: Write the failing test**

```js
// tests/helpers/dashboard/routes.test.js
const assert = require("node:assert/strict");
const test = require("node:test");
const { createDashboardRouter } = require("../../../helpers/dashboard/routes");
const { createSession, resetSessions, SESSION_COOKIE } = require("../../../helpers/dashboard/sessions");
const { resetGuildState } = require("../../../helpers/guildState");

const GUILD = "routes-test-guild";

function fakeClient() {
  const member = { id: "u1", permissions: { has: () => true } };
  return {
    guilds: {
      cache: new Map([[GUILD, {
        id: GUILD,
        name: "Test Server",
        ownerId: "u1",
        iconURL: () => null,
        members: { fetch: async () => member },
        channels: { cache: new Map() },
        roles: { cache: new Map() },
      }]]),
    },
  };
}

function fakeResponse() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(chunk) { this.body = chunk || ""; },
  };
}

function request({ method = "GET", cookie = "", origin = "https://mewbit.test", body = null } = {}) {
  const headers = { cookie, origin, host: "mewbit.test", "content-type": "application/json" };
  const stream = {
    method,
    headers,
    on(event, handler) {
      if (event === "data" && body) handler(Buffer.from(body));
      if (event === "end") handler();
      return this;
    },
  };
  return stream;
}

function url(path) {
  return new URL(path, "https://mewbit.test");
}

process.env.DASHBOARD_PUBLIC_URL = "https://mewbit.test";
process.env.CLIENT_ID = "client-123";
process.env.DISCORD_CLIENT_SECRET = "secret";

test("a path outside /api/dashboard is not owned by the router", async () => {
  const router = createDashboardRouter(fakeClient());
  assert.equal(await router.handle(request(), fakeResponse(), url("/api/activity/state")), false);
});

test("login redirects to Discord and plants a state cookie", async () => {
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request(), response, url("/api/dashboard/login"));
  assert.equal(response.statusCode, 302);
  assert.match(response.headers.Location, /^https:\/\/discord\.com\/oauth2\/authorize\?/);
  assert.ok(String(response.headers["Set-Cookie"]).includes("mewbit_dash_state="));
});

test("an unauthenticated identity request is rejected with 401", async () => {
  resetSessions();
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request(), response, url("/api/dashboard/me"));
  assert.equal(response.statusCode, 401);
});

test("an authenticated identity request returns the manageable guilds", async () => {
  resetSessions();
  const id = createSession({
    userId: "u1",
    username: "Neko",
    avatar: null,
    accessToken: "tok",
    guilds: [{ id: GUILD, name: "Test Server", permissions: "8" }],
  });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request({ cookie: `${SESSION_COOKIE}=${id}` }), response, url("/api/dashboard/me"));
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.user.username, "Neko");
  assert.deepEqual(payload.guilds.map((guild) => guild.id), [GUILD]);
});

test("reading settings for a guild the session does not administer is rejected", async () => {
  resetSessions();
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request({ cookie: `${SESSION_COOKIE}=${id}` }), response, url(`/api/dashboard/guilds/${GUILD}/settings`));
  assert.equal(response.statusCode, 403);
});

test("reading settings for an administered guild returns the settings shape", async () => {
  resetSessions();
  resetGuildState(GUILD);
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [{ id: GUILD, permissions: "8" }] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request({ cookie: `${SESSION_COOKIE}=${id}` }), response, url(`/api/dashboard/guilds/${GUILD}/settings`));
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.settings.source.defaultSource, "deezer");
  assert.ok(payload.settings.options);
});

test("a write from a foreign origin is rejected with 403", async () => {
  resetSessions();
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [{ id: GUILD, permissions: "8" }] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(
    request({ method: "PATCH", cookie: `${SESSION_COOKIE}=${id}`, origin: "https://evil.test", body: "{}" }),
    response,
    url(`/api/dashboard/guilds/${GUILD}/settings`)
  );
  assert.equal(response.statusCode, 403);
});

test("a valid write persists and returns the refreshed settings", async () => {
  resetSessions();
  resetGuildState(GUILD);
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [{ id: GUILD, permissions: "8" }] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(
    request({
      method: "PATCH",
      cookie: `${SESSION_COOKIE}=${id}`,
      body: JSON.stringify({ source: { defaultSource: "spotify" } }),
    }),
    response,
    url(`/api/dashboard/guilds/${GUILD}/settings`)
  );
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).settings.source.defaultSource, "spotify");
});

test("an invalid write is rejected with 400", async () => {
  resetSessions();
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [{ id: GUILD, permissions: "8" }] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(
    request({
      method: "PATCH",
      cookie: `${SESSION_COOKIE}=${id}`,
      body: JSON.stringify({ source: { defaultSource: "napster" } }),
    }),
    response,
    url(`/api/dashboard/guilds/${GUILD}/settings`)
  );
  assert.equal(response.statusCode, 400);
});

test("logout clears the session cookie", async () => {
  resetSessions();
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request({ method: "POST", cookie: `${SESSION_COOKIE}=${id}` }), response, url("/api/dashboard/logout"));
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["Set-Cookie"]), /Max-Age=0/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/helpers/dashboard/routes.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```js
// helpers/dashboard/routes.js
const { randomBytes } = require("node:crypto");
const Log = require("../logs/log");
const { consumeRateLimit } = require("../security/rateLimit");
const {
  getDashboardConfig,
  buildAuthorizeUrl,
  exchangeCode,
  fetchOauthUser,
  fetchOauthGuilds,
} = require("./oauth");
const { listManageableGuilds, hasAdminFromOauthGuild, assertGuildAdmin } = require("./permissions");
const {
  createSession,
  getSession,
  destroySession,
  parseCookies,
  serializeSessionCookie,
  serializeStateCookie,
  serializeClearCookie,
  SESSION_COOKIE,
  STATE_COOKIE,
} = require("./sessions");
const { readGuildSettings, applyGuildSettings } = require("./settings");

const MAX_BODY_SIZE = 32 * 1024;
const PREFIX = "/api/dashboard";
const SETTINGS_PATTERN = /^\/api\/dashboard\/guilds\/(\d{5,25})\/settings$/;

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location, extraHeaders = {}) {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store", ...extraHeaders });
  response.end("");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Request body must be JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function requestAddress(request) {
  return request.socket?.remoteAddress || request.headers["x-forwarded-for"] || "unknown";
}

function enforceRateLimit(request, bucket, limit, windowMs) {
  const result = consumeRateLimit(`dash:${bucket}:${requestAddress(request)}`, { limit, windowMs });
  if (!result.allowed) throw Object.assign(new Error("Too many requests. Try again shortly."), { statusCode: 429 });
}

function requireSession(request) {
  const cookies = parseCookies(request.headers.cookie);
  const session = getSession(cookies[SESSION_COOKIE]);
  if (!session) throw Object.assign(new Error("Sign in with Discord to continue."), { statusCode: 401 });
  return session;
}

function assertSameOrigin(request, config) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (origin !== config.publicUrl) {
    throw Object.assign(new Error("Request origin is not allowed."), { statusCode: 403 });
  }
}

function createDashboardRouter(client) {
  async function route(request, response, url) {
    const config = getDashboardConfig();
    if (!config.enabled) throw Object.assign(new Error("The dashboard is disabled."), { statusCode: 503 });

    const cookieOptions = { secure: config.secure, maxAgeMs: 10 * 60 * 1000 };

    if (request.method === "GET" && url.pathname === `${PREFIX}/login`) {
      enforceRateLimit(request, "login", 20, 60_000);
      if (!config.clientId || !config.clientSecret) {
        throw Object.assign(new Error("The dashboard OAuth credentials are not configured."), { statusCode: 503 });
      }
      const state = randomBytes(16).toString("hex");
      return redirect(response, buildAuthorizeUrl(state, config), {
        "Set-Cookie": serializeStateCookie(state, cookieOptions),
      });
    }

    if (request.method === "GET" && url.pathname === `${PREFIX}/callback`) {
      enforceRateLimit(request, "callback", 20, 60_000);
      const cookies = parseCookies(request.headers.cookie);
      const state = url.searchParams.get("state");
      if (!state || state !== cookies[STATE_COOKIE]) {
        throw Object.assign(new Error("Sign-in could not be verified. Start again."), { statusCode: 400 });
      }
      const code = url.searchParams.get("code");
      if (!code) throw Object.assign(new Error("Discord did not return an authorization code."), { statusCode: 400 });

      const token = await exchangeCode(code, config);
      const user = await fetchOauthUser(token.access_token);
      const guilds = await fetchOauthGuilds(token.access_token);
      const sessionId = createSession({
        userId: user.id,
        username: user.global_name || user.username || "Discord user",
        avatar: user.avatar || null,
        accessToken: token.access_token,
        guilds: guilds.filter(hasAdminFromOauthGuild).map((guild) => ({
          id: guild.id,
          name: guild.name,
          permissions: guild.permissions,
          owner: guild.owner,
        })),
      });

      return redirect(response, `${config.publicUrl}/dashboard`, {
        "Set-Cookie": [
          serializeSessionCookie(sessionId, { secure: config.secure, maxAgeMs: 7 * 24 * 60 * 60 * 1000 }),
          serializeClearCookie({ secure: config.secure, name: STATE_COOKIE }),
        ],
      });
    }

    if (request.method === "POST" && url.pathname === `${PREFIX}/logout`) {
      const cookies = parseCookies(request.headers.cookie);
      destroySession(cookies[SESSION_COOKIE]);
      return sendJson(response, 200, { ok: true }, { "Set-Cookie": serializeClearCookie({ secure: config.secure }) });
    }

    if (request.method === "GET" && url.pathname === `${PREFIX}/me`) {
      const session = requireSession(request);
      return sendJson(response, 200, {
        ok: true,
        user: { id: session.userId, username: session.username, avatar: session.avatar },
        guilds: listManageableGuilds(client, session.guilds),
      });
    }

    const settingsMatch = SETTINGS_PATTERN.exec(url.pathname);
    if (settingsMatch) {
      const guildId = settingsMatch[1];
      const session = requireSession(request);

      if (!session.guilds.some((guild) => guild.id === guildId)) {
        throw Object.assign(new Error("You need Administrator permission in this server."), { statusCode: 403 });
      }
      await assertGuildAdmin(client, guildId, session.userId);

      if (request.method === "GET") {
        return sendJson(response, 200, { ok: true, settings: readGuildSettings(client, guildId) });
      }

      if (request.method === "PATCH") {
        assertSameOrigin(request, config);
        enforceRateLimit(request, "write", 60, 60_000);
        const patch = await readJsonBody(request);
        return sendJson(response, 200, { ok: true, settings: applyGuildSettings(guildId, patch, client) });
      }

      throw Object.assign(new Error("Method not allowed."), { statusCode: 405 });
    }

    throw Object.assign(new Error("Not found"), { statusCode: 404 });
  }

  return {
    async handle(request, response, url) {
      if (!url.pathname.startsWith(`${PREFIX}/`)) return false;
      try {
        await route(request, response, url);
      } catch (error) {
        const status = Number(error.statusCode) || 500;
        if (status >= 500) Log.error("Dashboard request failed", error, `path=${url.pathname}`);
        sendJson(response, status, { ok: false, error: error.message || "Dashboard error" });
      }
      return true;
    },
  };
}

module.exports = { createDashboardRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/helpers/dashboard/routes.test.js`
Expected: PASS — 10 tests

- [ ] **Step 5: Wire the router into the Activity gateway**

In `helpers/activity/server.js`, add near the other requires at the top:

```js
const { createDashboardRouter } = require("../dashboard/routes");
```

Inside `createActivityServer`, before `async function handleRequest`, add:

```js
const dashboardRouter = createDashboardRouter(client);
```

Inside `handleRequest`, immediately after `const url = new URL(...)` and before the existing `try {`, add:

```js
    if (url.pathname.startsWith("/api/dashboard/")) {
      const handled = await dashboardRouter.handle(request, response, url);
      if (handled) return;
    }
```

- [ ] **Step 6: Document the new environment variables**

Append to `.env-example`:

```
# --- Dashboard (web settings surface) ---
DASHBOARD_ENABLED=true
# Public origin the dashboard and landing page are served from. Used for the
# OAuth redirect, the post-login redirect, and the write-origin check.
DASHBOARD_PUBLIC_URL=http://localhost:5174
# Defaults to DASHBOARD_PUBLIC_URL + /api/dashboard/callback. Must be listed
# as a redirect URI in the Discord application's OAuth2 settings.
DASHBOARD_OAUTH_REDIRECT_URI=
# Session lifetime in ms. Default 7 days. Sessions are in-memory and do not
# survive a bot restart.
DASHBOARD_SESSION_TTL_MS=604800000
```

- [ ] **Step 7: Run the full backend suite and lint**

Run: `pnpm test` then `pnpm lint`
Expected: all tests pass; no new lint errors.

- [ ] **Step 8: Commit**

```bash
git add helpers/dashboard/routes.js tests/helpers/dashboard/routes.test.js helpers/activity/server.js .env-example
git commit -m "feat(dashboard): route /api/dashboard through the bot gateway"
```

---

## Task 6: Public instance stats endpoint

**Files:**
- Modify: `helpers/dashboard/routes.js`
- Test: `tests/helpers/dashboard/routes.test.js` (append)

**Interfaces:**
- Consumes: `createDashboardRouter` from Task 5.
- Produces: `GET /api/dashboard/public/stats` returning `{ ok, instance: { servers, tracksPlayed, uptimeMs, version } }`. Consumed by `web/src/landing/LiveStats.jsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Append to `tests/helpers/dashboard/routes.test.js`:

```js
test("public stats are served without a session", async () => {
  resetSessions();
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request(), response, url("/api/dashboard/public/stats"));
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.instance.servers, 1);
  assert.equal(typeof payload.instance.tracksPlayed, "number");
  assert.equal(typeof payload.instance.uptimeMs, "number");
  assert.equal(typeof payload.instance.version, "string");
});

test("public stats survive an unavailable stats store", async () => {
  const router = createDashboardRouter({ guilds: { cache: new Map() } });
  const response = fakeResponse();
  await router.handle(request(), response, url("/api/dashboard/public/stats"));
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).instance.servers, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/helpers/dashboard/routes.test.js`
Expected: FAIL — the stats requests return 404

- [ ] **Step 3: Write minimal implementation**

Add to the requires in `helpers/dashboard/routes.js`:

```js
const statsStore = require("../stats/store");
const { version: packageVersion } = require("../../package.json");
```

Add inside `route`, before the `settingsMatch` block:

```js
    if (request.method === "GET" && url.pathname === `${PREFIX}/public/stats`) {
      enforceRateLimit(request, "stats", 120, 60_000);
      let tracksPlayed = 0;
      try {
        const global = statsStore.getGlobalStats();
        tracksPlayed = Number(global?.totalTracks ?? global?.tracksPlayed ?? 0) || 0;
      } catch {
        tracksPlayed = 0;
      }
      return sendJson(response, 200, {
        ok: true,
        instance: {
          servers: client?.guilds?.cache?.size ?? 0,
          tracksPlayed,
          uptimeMs: Math.floor(process.uptime() * 1000),
          version: packageVersion,
        },
      });
    }
```

- [ ] **Step 4: Confirm the real field name**

`getGlobalStats()`'s return shape decides which key holds the play count. Read it:

Run: `grep -n "function getGlobalStats" -A 25 helpers/stats/store.js`

If the returned object names the count something other than `totalTracks` or `tracksPlayed`, replace the fallback chain above with the actual key. Do not leave both guesses in place once the real name is known.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/helpers/dashboard/routes.test.js`
Expected: PASS — 12 tests

- [ ] **Step 6: Commit**

```bash
git add helpers/dashboard/routes.js tests/helpers/dashboard/routes.test.js
git commit -m "feat(dashboard): expose honest per-instance stats for the landing page"
```

---

## Task 7: `web/` scaffold, Obsidian tokens, API client

**Files:**
- Create: `web/package.json`, `web/vite.config.js`, `web/index.html`, `web/src/main.jsx`, `web/src/App.jsx`, `web/src/tokens.css`, `web/src/api.js`
- Modify: `package.json` (root scripts), `eslint.config.mjs` if `web/src` needs adding to the lint globs

**Interfaces:**
- Consumes: the routes from Tasks 5–6.
- Produces: `api.js` exports `getMe()`, `getSettings(guildId)`, `patchSettings(guildId, patch)`, `getPublicStats()`, `logout()`, and the class `ApiError` carrying `.status`. Routing exports nothing; `App.jsx` mounts `/` and `/dashboard/*`.

**Verification:** this task has no unit tests. It is verified by a clean build and a served dev page.

- [ ] **Step 1: Create the app scaffold**

`web/package.json`:

```json
{
  "name": "mewbit-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@phosphor-icons/react": "^2.1.10",
    "motion": "^13.0.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router-dom": "^7.9.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.5",
    "vite": "^8.2.1"
  }
}
```

`web/vite.config.js`:

```js
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const gateway = env.VITE_DASHBOARD_GATEWAY_URL || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: Number(env.VITE_WEB_PORT || 5174),
      strictPort: true,
      proxy: {
        "/api": { target: gateway, changeOrigin: true },
      },
    },
  };
});
```

`web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MewBit — self-hosted Discord music</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the Obsidian tokens**

`web/src/tokens.css` — copy the `:root` block from the Global Constraints verbatim, then add base element styles:

```css
:root {
  color-scheme: dark;
  --bg: #050608;
  --surface: #0c0e12;
  --raised: #111318;
  --high: #161920;
  --line: rgba(255, 255, 255, 0.06);
  --line-strong: rgba(255, 255, 255, 0.12);
  --text: #f4f6f9;
  --muted-strong: #c3cbd7;
  --muted: #9ba4b2;
  --faint: #667081;
  --accent: #67e3f4;
  --live: #ff6ec7;
  --auto: #a78bfa;
  --danger: #ff8098;
  --white-btn: #f4f6f9;
  --on-white: #0a0c10;
  --disp: "Hanken Grotesk", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --ease: cubic-bezier(0.32, 0.72, 0, 1);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 400 14px/1.55 var(--disp);
  -webkit-font-smoothing: antialiased;
}

.mono { font-family: var(--mono); font-feature-settings: "tnum"; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Write the API client**

`web/src/api.js`:

```js
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Something went wrong.", response.status);
  }
  return payload;
}

export const getMe = () => call("/api/dashboard/me");
export const getSettings = (guildId) => call(`/api/dashboard/guilds/${guildId}/settings`);
export const patchSettings = (guildId, patch) =>
  call(`/api/dashboard/guilds/${guildId}/settings`, { method: "PATCH", body: patch });
export const getPublicStats = () => call("/api/dashboard/public/stats");
export const logout = () => call("/api/dashboard/logout", { method: "POST" });
export const loginUrl = "/api/dashboard/login";
```

- [ ] **Step 4: Write the entry and router**

`web/src/main.jsx`:

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./tokens.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`web/src/App.jsx`:

```jsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./dashboard/Dashboard.jsx";
import Landing from "./landing/Landing.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:guildId" element={<Dashboard />} />
        <Route path="/dashboard/:guildId/:section" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

Create minimal placeholder `web/src/landing/Landing.jsx` and `web/src/dashboard/Dashboard.jsx` that each render a single `<main>` with the surface name, so the build compiles. Tasks 8–11 replace them.

- [ ] **Step 5: Add root scripts**

In the root `package.json` `scripts`, alongside the `activity:*` entries:

```json
"web:dev": "pnpm --dir web dev",
"web:build": "pnpm --dir web build",
"web:lint": "eslint web/src --ext .js,.jsx"
```

- [ ] **Step 6: Install and verify the build**

Run: `pnpm --dir web install` then `pnpm --dir web build`
Expected: build completes and writes `web/dist`.

- [ ] **Step 7: Commit**

```bash
git add web package.json eslint.config.mjs
git commit -m "feat(web): scaffold the web app with Obsidian tokens and the dashboard API client"
```

---

## Task 8: Landing — command line and response canvas

**Files:**
- Create: `web/src/landing/Landing.jsx`, `web/src/landing/CommandLine.jsx`, `web/src/landing/ResponseCanvas.jsx`, `web/src/landing/commands.js`, `web/src/landing/landing.css`
- Create: `web/src/landing/responses/{PlayResponse,QueueResponse,DjResponse,EqResponse,DeployResponse}.jsx`

**Interfaces:**
- Consumes: `tokens.css` from Task 7.
- Produces: `commands.js` exports `COMMANDS`, an ordered array of `{ id, name, signature, blurb, Response }`. `ResponseCanvas` takes `{ commandId }`. Task 9 imports `COMMANDS` for the index.

**Direction contract — place this as the first child of `<body>` in `web/index.html`, as an HTML comment so it survives the production build:**

```html
<!--
THESIS: MewBit's landing page is driven by the bot's own command line — reading it is already using it. It refuses the stacked hero-then-three-feature-cards arrangement every Discord bot site ships.
OWN-WORLD: Obsidian. Near-black #050608 ground, Hanken Grotesk display with JetBrains Mono for all data, white primary CTA, hairline rules. Colour only at edges and active-state marks: cyan live/focus, magenta like, violet autoplay.
STORY: A self-hosting operator understands MewBit is a real, complete music bot they can run themselves, and leaves for the repository.
FIRST VIEWPORT: A near-black field. One command line at optical centre with a blinking caret and cycling ghost text. Below it the response canvas renders what that command actually returns. The command index sits beneath; the primary action is its last entry.
FORM: Command Palette, index 5 of 7 on the ordered list; seed key ab48e825.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->
```

**Verification:** build succeeds; the page is fully readable and navigable without ever typing; the caret and ghost text make interactivity obvious within the first second.

- [ ] **Step 1: Define the command set**

`web/src/landing/commands.js` exports five commands whose responses are all true of the shipped bot — `/play`, `/queue`, `/dj`, `/eq`, and `deploy`. Each entry:

```js
export const COMMANDS = [
  { id: "play", name: "/play", signature: "/play <query>", blurb: "Search four sources at once. Deezer returns FLAC.", Response: PlayResponse },
  { id: "queue", name: "/queue", signature: "/queue", blurb: "Autoplay picks keep their own provenance mark.", Response: QueueResponse },
  { id: "dj", name: "/dj", signature: "/dj", blurb: "Role gating, vote skipping, strict mode.", Response: DjResponse },
  { id: "eq", name: "/eq", signature: "/eq <preset>", blurb: "Band EQ with presets you can save per user.", Response: EqResponse },
  { id: "deploy", name: "deploy", signature: "git clone", blurb: "Run the whole thing yourself.", Response: DeployResponse },
];
```

- [ ] **Step 2: Build the command line**

`CommandLine.jsx` renders a single row: a mono `/` prompt glyph, an input, and a caret. Requirements:

- The caret blinks at 1s steps and is suppressed under `prefers-reduced-motion`.
- Ghost text cycles through `COMMANDS[n].signature` every 2.6s while the input is empty and unfocused; it stops on focus.
- The input is a real `<input>` with `aria-label="Try a MewBit command"` and `autoComplete="off"`.
- Typing filters the command index; Enter selects the top match; Up/Down move the selection; Escape clears.
- Selection **inverts** the row (`background: var(--text); color: var(--on-white)`) rather than tinting it — this is the Four-Shade Field raise and is binding.

- [ ] **Step 3: Build the response canvas**

`ResponseCanvas.jsx` takes `commandId`, looks up `COMMANDS`, and renders that command's `Response` inside a panel using the brandboard's elevation exactly:

```css
.canvas {
  border-radius: 16px;
  background: var(--surface);
  outline: 1px solid var(--line);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 2px 4px rgba(0, 0, 0, 0.35), 0 20px 56px rgba(0, 0, 0, 0.35);
  padding: 18px;
}
```

Swapping commands cross-fades and translates the outgoing panel by 8px over 240ms with `var(--ease)`, via `motion`'s `AnimatePresence`. Under reduced motion the swap is instant.

- [ ] **Step 4: Build the five response modules**

Each renders real MewBit UI vocabulary reusing the brandboard components:

- `PlayResponse` — three search results, each a `qrow` with cover, title, author, and a `srctag` naming the resolved provider. Providers shown: Deezer, SoundCloud, YouTube.
- `QueueResponse` — four queue rows, one carrying the violet `autotag` reading "autoplay next". This is the only violet on the page.
- `DjResponse` — a vote-skip state: "3 of 5 votes", a threshold readout in mono, and the DJ role chip.
- `EqResponse` — eight vertical band sliders at fixed positions with mono dB labels, plus a preset name. Static positions, not draggable — this is a demonstration, not the EQ.
- `DeployResponse` — the real clone and compose commands in a mono block, and the white primary CTA linking to `https://github.com/Marczelloo/NeoBeat-Buddy`.

All track and artist names in these responses are demonstration content. Label the block containing them with a small `faint` caption reading "Example session" so nothing reads as a live claim.

- [ ] **Step 5: Verify in the browser**

Run: `pnpm --dir web dev`, open `http://127.0.0.1:5174/`
Confirm: caret blinks; ghost text cycles; typing filters; Enter swaps the canvas; selection inverts; every response renders; the page is fully usable with the keyboard alone.

- [ ] **Step 6: Commit**

```bash
git add web/src/landing web/index.html
git commit -m "feat(web): build the Command Palette landing surface"
```

---

## Task 9: Landing — index, live stats, close, motion

**Files:**
- Modify: `web/src/landing/Landing.jsx`, `web/src/landing/landing.css`
- Create: `web/src/landing/LiveStats.jsx`, `web/src/landing/FeatureLedger.jsx`, `web/src/landing/SiteFooter.jsx`

**Interfaces:**
- Consumes: `COMMANDS` from Task 8, `getPublicStats` from Task 7.
- Produces: nothing consumed later.

- [ ] **Step 1: Build the command index**

Beneath the canvas, render `COMMANDS` as rows: mono signature on the left, blurb in `--muted` on the right. Hovering or arrowing to a row previews it in the canvas. The final row is `deploy`, styled as the primary action with the white button treatment (`h36`, `padding 0 16px`, `radius 10`, `background var(--white-btn)`, `color var(--on-white)`, `inset 0 1px 0 rgba(255,255,255,.55)`, `active scale .98`).

- [ ] **Step 2: Build live stats**

`LiveStats.jsx` calls `getPublicStats()` on mount and renders servers, tracks played, uptime and version as mono figures with `font-feature-settings: "tnum"`.

Three designed states, all required:

- **Loading** — mono em-dashes in the figure slots, no spinner.
- **Small or zero counts** — render the real number plainly. Never hide a small number and never round it up.
- **Unreachable** — the whole block is replaced by one `faint` line: "Instance stats are unavailable right now." No error styling, no retry button.

The block carries a permanent caption: "Live from this instance." It must never imply network-wide adoption.

- [ ] **Step 3: Build the feature ledger**

`FeatureLedger.jsx` lists the verifiable capability inventory from PRODUCT.md as a dense two-column ledger: Deezer FLAC playback, multi-source search across four providers, autoplay v3, DJ mode with vote skipping, equalizer presets with custom user presets, synced lyrics, filter presets, playlists with URL import, per-guild statistics, and the Discord Activity player.

Every entry must be true of the shipped bot. No entry gets a metric attached.

- [ ] **Step 4: Build the close**

`SiteFooter.jsx` anchors the page: the repository link as the real close, the licence, and a link to `/dashboard`. One spacing rhythm throughout the page, with more space above a heading than below it.

- [ ] **Step 5: Author the page motion**

Motion is the form's own: a command line responds. Give the page one orchestrated motion grammar, not scattered hover effects.

- Canvas swap: 240ms fade + 8px translate, `var(--ease)`.
- Command index rows: 120ms background transition on hover; selection inverts instantly.
- Section reveals: a single `IntersectionObserver`-driven fade + 8px rise, 260ms, staggered 40ms within a section only.
- The EQ demonstration bars in `EqResponse` animate only while that response is on screen.
- Every one of these is disabled by the `prefers-reduced-motion` block in `tokens.css`, and content is visible by default — never hidden behind an animation that must run to reveal it.

- [ ] **Step 6: Verify in the browser at both sizes**

Run: `pnpm --dir web dev`
Confirm at 1440px and 390px: no horizontal body scroll; the command line stays usable; live stats render in all three states (test the unreachable state by stopping the bot); reduced motion leaves everything visible.

- [ ] **Step 7: Commit**

```bash
git add web/src/landing
git commit -m "feat(web): add command index, honest instance stats, feature ledger and page motion"
```

---

## Task 10: Dashboard — shell, auth states, server rail

**Files:**
- Create: `web/src/dashboard/Dashboard.jsx`, `web/src/dashboard/ServerRail.jsx`, `web/src/dashboard/SectionList.jsx`, `web/src/dashboard/dashboard.css`
- Create: `web/src/dashboard/states/{SignedOut,NoServers,GuildGone,GatewayDown,Loading}.jsx`

**Interfaces:**
- Consumes: `getMe`, `logout`, `loginUrl`, `ApiError` from Task 7.
- Produces: `Dashboard.jsx` owns the `{ user, guilds, activeGuildId, activeSection }` state and renders the section components from Task 11 into its main column. `SECTIONS` is exported from `SectionList.jsx` as `[{ id, label }]` with ids `player`, `source`, `dj`, `announcements`.

**Direction contract — add as an HTML comment inside the dashboard shell's root element:**

```
THESIS: The settings surface uses the affordance this audience already operates fluently in Discord itself — server rail, section list, settings column — executed at a craft level the familiar version never gets. It refuses novelty in a surface people visit for thirty seconds.
OWN-WORLD: Obsidian, strict. Near-black ground, hairline separation, elevation never colour. White primary CTA. Cyan marks only the active nav item and focus.
STORY: An admin signs in, recognises the layout instantly, changes one setting, sees it land on the live bot, and leaves.
FIRST VIEWPORT: Server icon rail far left. Section list beside it. Settings in the main column at generous measure, each control stating what it changes in the bot's own terms. Save state at the column's foot.
FORM: Server Rail, index 1 of 7 on the ordered list, locked as the pick card over the dealt lead; seed key 2e58cda9.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
```

- [ ] **Step 1: Build the auth state machine**

`Dashboard.jsx` calls `getMe()` on mount and branches on the result:

| Condition | Render |
|---|---|
| request in flight | `<Loading />` |
| `ApiError` with `status === 401` | `<SignedOut />` |
| request threw for any other reason | `<GatewayDown />` |
| `guilds.length === 0` | `<NoServers />` |
| `:guildId` present but not in `guilds` | `<GuildGone />` |
| otherwise | the shell |

With no `:guildId` in the URL, redirect to the first guild's `player` section.

- [ ] **Step 2: Write the state screens**

Each is a centred column, max-width 46ch, with a heading, one sentence, and at most one action. Copy, verbatim:

- `SignedOut` — "Sign in to configure MewBit." / "You'll need Administrator permission on a server MewBit is already in." / white button "Continue with Discord" linking to `loginUrl`.
- `NoServers` — "No servers to configure." / "You administer no servers that MewBit has been added to. Invite the bot to a server you administer, then come back." / ghost button "Back to home".
- `GuildGone` — "MewBit isn't in this server any more." / "It may have been removed while this page was open." / ghost button "Choose another server".
- `GatewayDown` — "Can't reach the bot." / "The MewBit gateway isn't responding. Settings can't be read or changed until it's back." / ghost button "Try again" that refetches.
- `Loading` — the section skeleton, not a spinner.

- [ ] **Step 3: Build the server rail**

Vertical rail, width 68px, `background var(--surface)`, `outline 1px solid var(--line)`, `border-radius 16px`. Each guild is a 44px square with `border-radius 12px` showing the icon, or the initials in Hanken 700 when `icon` is null.

The active guild is marked by a 3px cyan bar pinned to the rail's inner edge — not a coloured background. Every item has an accessible name via `aria-label` and a tooltip on hover.

- [ ] **Step 4: Build the section list**

`SECTIONS = [{ id: "player", label: "Player" }, { id: "source", label: "Source" }, { id: "dj", label: "DJ" }, { id: "announcements", label: "Announcements" }]`.

Rendered as a `<nav>` of links to `/dashboard/:guildId/:section`. The active item takes `color: var(--text)` and `background: rgba(255,255,255,.08)` — neutral, per the brandboard's mapping table, not cyan fill.

- [ ] **Step 5: Verify in the browser**

Run the bot and `pnpm --dir web dev`. Confirm each of the six branches renders, including signing out and revisiting.

- [ ] **Step 6: Commit**

```bash
git add web/src/dashboard
git commit -m "feat(web): build the dashboard shell, auth states and server rail"
```

---

## Task 11: Dashboard — the four settings sections

**Files:**
- Create: `web/src/dashboard/sections/{PlayerSection,SourceSection,DjSection,AnnouncementsSection}.jsx`
- Create: `web/src/dashboard/SaveState.jsx`, `web/src/dashboard/controls/{Field,Toggle,Select,Slider}.jsx`
- Modify: `web/src/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `getSettings`, `patchSettings` from Task 7; the settings shape from Task 3.
- Produces: nothing consumed later.

- [ ] **Step 1: Build the shared controls**

Built to the brandboard's component spec exactly:

- `Field` — label in `600 11.5px` `var(--muted)`, control beneath, and an always-present description line in `--faint` stating what the setting changes in the bot's terms.
- `Toggle` — `radius 11`, `padding 9px 11px`; on = `background rgba(255,255,255,.05)` + `outline 1px solid var(--line-strong)`. Neutral, never cyan fill.
- `Select` — `height 31`, `radius 8`, `background var(--raised)`, `outline 1px solid var(--line-strong)`.
- `Slider` — native `<input type="range">`; track `height 4`, `radius 99`, fill `var(--white-btn)`, rest `rgba(255,255,255,.1)`; thumb a 13px white circle with a 2px `var(--bg)` border.

- [ ] **Step 2: Build the sections**

Each maps one-to-one onto the settings shape:

- **Player** — player channel `Select` from `options.channels` with an explicit "Not set" option; autoplay `Toggle`; 24/7 radio `Toggle`.
- **Source** — default search source `Select` over the four sources, each labelled with what it means ("Deezer — FLAC quality").
- **DJ** — enabled `Toggle`; DJ role `Select` from `options.roles`; skip mode `Select` over DJ / Vote / Hybrid; vote threshold `Slider` from 0.1 to 1.0 step 0.05, displayed as a percentage in mono; strict mode `Toggle`.
- **Announcements** — announcement channel `Select`; announcements enabled `Toggle`.

- [ ] **Step 3: Surface the DJ interdependencies inline**

This is binding, and is the discipline retained from the Force Diagram challenger. At the control, not as post-hoc validation:

- With DJ mode **off**, the role, skip mode, threshold and strict-mode controls render disabled with one `faint` line: "DJ mode is off — everyone can control playback."
- With strict mode **on** and **no role selected**, the strict-mode control shows a `--danger` line: "Strict mode does nothing until a DJ role is set. Only the server owner can control playback right now."
- The vote threshold control renders disabled with an explanatory line whenever skip mode is `dj`: "Skip mode is DJ-only, so the vote threshold is unused."

- [ ] **Step 4: Build the save behaviour**

Changes are optimistic against local state and `PATCH`ed per section. `SaveState.jsx` pins to the column foot and has four states: idle (nothing rendered), dirty ("Unsaved changes" + white "Save" button), saving (button disabled, label "Saving…"), and saved.

The **saved** state is the Nixie raise and is binding: the write confirms as a visible event on the changed control — a 220ms mark that fades in beside the field and settles — not a corner toast alone. The admin sees the write land on the specific setting they changed.

On a `PATCH` failure, revert the optimistic value to the server's last known value and show the error message from the API beneath the field in `--danger`. Never leave a failed value looking saved.

- [ ] **Step 5: Handle the concurrent-change case**

Every successful `PATCH` returns the full refreshed settings. Replace local state with that response wholesale, so a value changed by a slash command while the page was open corrects itself on the next save rather than being silently overwritten by stale local state.

- [ ] **Step 6: Verify against the running bot**

Run the bot and the dev server. For each of the ten settings in the spec's table: change it in the dashboard, then confirm with the corresponding slash command's status subcommand that the bot sees the new value. Then change it via slash command, reload the dashboard, and confirm the dashboard shows it.

- [ ] **Step 7: Commit**

```bash
git add web/src/dashboard
git commit -m "feat(web): build the four settings sections with inline consequences and visible saves"
```

---

## Task 12: Responsive, detector, finish review

**Files:**
- Modify: whatever the review names
- Create: `.impeccable/review/desktop.png`, `.impeccable/review/mobile.png`

- [ ] **Step 1: Make both surfaces responsive**

Landing: single column below 900px; the command line stays at optical centre and full width; the command index becomes a single column; the ledger collapses to one column.

Dashboard: below 900px the server rail becomes a horizontal strip above the section list, and the section list becomes a horizontal scroller above the settings column. No horizontal body scroll at 390px on either surface. Wide content scrolls inside its own container.

- [ ] **Step 2: Full verification sweep**

Run each and confirm before proceeding:

```bash
pnpm test
```

```bash
pnpm lint && pnpm --dir web build
```

- [ ] **Step 3: Run the mechanical detector once**

Run: `node C:\Users\moskw\.claude\plugins\cache\impeccable\impeccable\4.1.2\skills\impeccable\scripts/detect.mjs --json web/src`

Fix everything mechanical it reports. Keep the remaining findings for the reviewer. Run it once only.

- [ ] **Step 4: Capture evidence**

Settle entrance motion first, then capture full-page shots from the document top into `.impeccable/review/desktop.png` (1440px) and `.impeccable/review/mobile.png` (390px), covering both the landing page and the dashboard. Open every file and confirm it shows what its name claims before sending — no blank regions, no half-loaded states.

- [ ] **Step 5: Spawn the finish reviewer**

Spawn `impeccable-finish-reviewer` fresh, with no forked history, passing: the original request, the confirmed answers, the artifact paths, the screenshot paths, both direction contracts, the detector findings, the craft-floor reference path, and one line noting this is a code-led build with no approved comp.

Act on the disposition word: **fix** applies the batch, rebuilds, recaptures the same viewports, and returns for a verdict pass; **rebuild** re-derives the named regions immediately; **ship** proceeds; **recapture** re-captures before any review binds.

- [ ] **Step 6: Document the built system**

Spawn `impeccable-documenter` with the project root, the artifact paths, both direction contracts, PRODUCT.md, and the boundary to write at. DESIGN.md currently describes only the Activity; the documenter records the web surfaces from what was actually built.

- [ ] **Step 7: Final commit**

```bash
git add -A web helpers docs .impeccable DESIGN.md
git commit -m "feat(web): finish review fixes and design documentation"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| `web/` app, React 19 + Vite 8 + router | 7 |
| `helpers/dashboard/` module split | 1–6 |
| OAuth login / callback / logout | 4, 5 |
| Server-side in-memory sessions, httpOnly cookie | 1, 5 |
| Guild list = admin ∩ bot guilds | 2, 5 |
| Server-side re-verification on every guild request | 2, 5 |
| CSRF origin check, rate limiting | 5 |
| Settings projection through the stores, all 10 fields | 3, 11 |
| Landing live stats, honestly labelled, 3 states | 6, 9 |
| Feature inventory as proof | 9 |
| Env vars documented | 5 |
| Error and edge states (all 7) | 9, 10, 11, 12 |
| Backend test coverage | 1–6 |
| Locked landing direction (Command Palette) | 8, 9 |
| Locked dashboard direction (Server Rail) | 10, 11 |

No spec section is unimplemented.

**Placeholder scan:** no TBDs. Task 6 Step 4 is a deliberate verification step against real source, not a placeholder — it names the exact command to run and requires removing the guess once the real key is known.

**Type consistency:** the settings shape declared in Task 3 is the same shape returned by Task 5's routes, consumed by Task 11. `SESSION_COOKIE` and `STATE_COOKIE` are defined in Task 1 and imported by Task 5. `COMMANDS` is defined in Task 8 and imported in Task 9. `SECTIONS` is defined in Task 10 and used in Task 11. `ApiError.status` is set in Task 7 and branched on in Task 10.
