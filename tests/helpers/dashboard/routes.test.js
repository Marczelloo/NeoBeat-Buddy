process.env.DASHBOARD_PUBLIC_URL = "https://mewbit.test";
process.env.CLIENT_ID = "client-123";
process.env.DISCORD_CLIENT_SECRET = "secret";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDashboardRouter } = require("../../../helpers/dashboard/routes");
const { createSession, resetSessions, SESSION_COOKIE } = require("../../../helpers/dashboard/sessions");
const { resetGuildState } = require("../../../helpers/guildState");

const GUILD = "900000000000000009";

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
  return {
    method,
    headers: { cookie, origin, host: "mewbit.test", "content-type": "application/json" },
    socket: { remoteAddress: `1.2.3.${Math.floor(Math.random() * 250) + 1}` },
    on(event, handler) {
      if (event === "data" && body) handler(Buffer.from(body));
      if (event === "end") handler();
      return this;
    },
  };
}

function url(path) {
  return new URL(path, "https://mewbit.test");
}

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
  await router.handle(
    request({ cookie: `${SESSION_COOKIE}=${id}` }),
    response,
    url(`/api/dashboard/guilds/${GUILD}/settings`)
  );
  assert.equal(response.statusCode, 403);
});

test("reading settings for an administered guild returns the settings shape", async () => {
  resetSessions();
  resetGuildState(GUILD);
  const id = createSession({ userId: "u1", accessToken: "tok", guilds: [{ id: GUILD, permissions: "8" }] });
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(
    request({ cookie: `${SESSION_COOKIE}=${id}` }),
    response,
    url(`/api/dashboard/guilds/${GUILD}/settings`)
  );
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
  await router.handle(
    request({ method: "POST", cookie: `${SESSION_COOKIE}=${id}` }),
    response,
    url("/api/dashboard/logout")
  );
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["Set-Cookie"]), /Max-Age=0/);
});

test("public stats are served without a session", async () => {
  resetSessions();
  const router = createDashboardRouter(fakeClient());
  const response = fakeResponse();
  await router.handle(request(), response, url("/api/dashboard/public/stats"));
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.instance.servers, 1);
  assert.equal(typeof payload.instance.songsPlayed, "number");
  assert.equal(typeof payload.instance.msPlayed, "number");
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
