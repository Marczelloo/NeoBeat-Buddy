process.env.DASHBOARD_PUBLIC_URL = "https://mewbit.test";
process.env.CLIENT_ID = "client-123";
process.env.DISCORD_CLIENT_SECRET = "secret";

const assert = require("node:assert/strict");
const test = require("node:test");
const accessStore = require("../../../helpers/dashboard/access");
const { createDashboardRouter } = require("../../../helpers/dashboard/routes");
const { createSession, resetSessions, SESSION_COOKIE } = require("../../../helpers/dashboard/sessions");
const { resetGuildState } = require("../../../helpers/guildState");

const GUILD = "900000000000000009";

function fakeClient({ ownerId = "u1", members = ["u1", "u2"] } = {}) {
  return {
    guilds: {
      cache: new Map([[GUILD, {
        id: GUILD,
        name: "Test Server",
        ownerId,
        iconURL: () => null,
        members: {
          fetch: async (userId) => {
            if (!members.includes(userId)) throw new Error("Unknown Member");
            return { id: userId, user: { username: `name-${userId}` } };
          },
        },
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

function request({
  method = "GET",
  cookie = "",
  origin = "https://mewbit.test",
  body = null,
  peer = `1.2.3.${Math.floor(Math.random() * 250) + 1}`,
  forwardedFor = null,
} = {}) {
  return {
    method,
    headers: {
      cookie,
      origin,
      host: "mewbit.test",
      "content-type": "application/json",
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    },
    socket: { remoteAddress: peer },
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
  const written = JSON.parse(response.body);
  assert.equal(written.settings.source.defaultSource, "spotify");
  // The route carries partial-failure detail back alongside the saved state, so
  // the UI can report a refused Discord permission without calling the whole
  // write a failure. A clean save still has to send the empty list.
  assert.deepEqual(written.warnings, []);
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

/* ------------------------------------------------------- rate limiting --- */

async function stats(router, options) {
  const response = fakeResponse();
  await router.handle(request(options), response, url("/api/dashboard/public/stats"));
  return response.statusCode;
}

test("behind a proxy, two visitors do not share one rate-limit bucket", async () => {
  // Every request arrives from the proxy, so socket.remoteAddress is identical.
  // Without DASHBOARD_TRUST_PROXY the limiter buckets them together and one
  // visitor can lock out everyone else.
  process.env.DASHBOARD_TRUST_PROXY = "1";
  const router = createDashboardRouter(fakeClient());
  const proxy = "10.0.0.1";

  let noisy = null;
  for (let i = 0; i < 125; i += 1) {
    noisy = await stats(router, { peer: proxy, forwardedFor: "203.0.113.10" });
  }
  const bystander = await stats(router, { peer: proxy, forwardedFor: "198.51.100.77" });

  assert.equal(noisy, 429);
  assert.equal(bystander, 200);
  delete process.env.DASHBOARD_TRUST_PROXY;
});

test("X-Forwarded-For is ignored unless the deployment declares its proxies", async () => {
  // Otherwise anyone could rotate the header and never be limited at all.
  delete process.env.DASHBOARD_TRUST_PROXY;
  const router = createDashboardRouter(fakeClient());
  const proxy = "10.0.0.2";

  let last = null;
  for (let i = 0; i < 125; i += 1) {
    last = await stats(router, { peer: proxy, forwardedFor: `203.0.113.${i % 200}` });
  }

  assert.equal(last, 429);
});

test("reading settings is rate limited, not just writing", async () => {
  delete process.env.DASHBOARD_TRUST_PROXY;
  resetSessions();
  resetGuildState(GUILD);
  const router = createDashboardRouter(fakeClient());
  const id = createSession({ userId: "u1", username: "u", guilds: [{ id: GUILD }] });
  const peer = "10.0.0.3";

  let last = null;
  for (let i = 0; i < 245; i += 1) {
    const response = fakeResponse();
    await router.handle(
      request({ cookie: `${SESSION_COOKIE}=${id}`, peer }),
      response,
      url(`/api/dashboard/guilds/${GUILD}/settings`)
    );
    last = response.statusCode;
  }

  assert.equal(last, 429);
});

/* ------------------------------------------------------ access endpoint --- */


// The operator store validates ids as snowflakes, so the placeholder "u1"/"u2"
// the older tests use cannot be stored as operators.
const OWNER_ID = "700000000000000001";
const OPERATOR_ID = "700000000000000002";

function accessClient() {
  return fakeClient({ ownerId: OWNER_ID, members: [OWNER_ID, OPERATOR_ID] });
}

function accessUrl() {
  return url(`/api/dashboard/guilds/${GUILD}/access`);
}

async function call(router, options, target = accessUrl()) {
  const response = fakeResponse();
  await router.handle(request(options), response, target);
  return response;
}

test("the owner can read the operator list and the change log", async () => {
  resetSessions();
  accessStore.resetGuildAccess(GUILD);
  accessStore.setOperators(GUILD, [OPERATOR_ID]);
  const router = createDashboardRouter(accessClient());
  const id = createSession({ userId: OWNER_ID, username: "Owner", guilds: [{ id: GUILD }] });

  const response = await call(router, { cookie: `${SESSION_COOKIE}=${id}` });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.access.viewerIsOwner, true);
  assert.deepEqual(payload.access.operators.map((o) => o.id), [OPERATOR_ID]);
  assert.ok(Array.isArray(payload.log));
});

test("an operator may read the list but not change it", async () => {
  resetSessions();
  accessStore.resetGuildAccess(GUILD);
  accessStore.setOperators(GUILD, [OPERATOR_ID]);
  const router = createDashboardRouter(accessClient());
  const id = createSession({ userId: OPERATOR_ID, username: "Operator", guilds: [{ id: GUILD }] });

  const read = await call(router, { cookie: `${SESSION_COOKIE}=${id}` });
  assert.equal(read.statusCode, 200);
  assert.equal(JSON.parse(read.body).access.viewerIsOwner, false);

  // Otherwise an operator could promote anyone, including themselves.
  const write = await call(router, {
    method: "PUT",
    cookie: `${SESSION_COOKIE}=${id}`,
    body: JSON.stringify({ operators: [OPERATOR_ID, OWNER_ID] }),
  });
  assert.equal(write.statusCode, 403);
});

test("the owner can name an operator, and it is written to the trail", async () => {
  resetSessions();
  accessStore.resetGuildAccess(GUILD);
  const router = createDashboardRouter(accessClient());
  const id = createSession({ userId: OWNER_ID, username: "Owner", guilds: [{ id: GUILD }] });

  const response = await call(router, {
    method: "PUT",
    cookie: `${SESSION_COOKIE}=${id}`,
    body: JSON.stringify({ operators: [OPERATOR_ID] }),
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.access.operators.map((o) => o.id), [OPERATOR_ID]);
  assert.equal(payload.log[0].section, "access");
  assert.match(payload.log[0].to, new RegExp(`dashboard access for ${OPERATOR_ID}`));
});

test("naming someone who is not in the server is refused", async () => {
  resetSessions();
  accessStore.resetGuildAccess(GUILD);
  const router = createDashboardRouter(accessClient());
  const id = createSession({ userId: OWNER_ID, username: "Owner", guilds: [{ id: GUILD }] });

  // Otherwise the grant would sit dormant and activate if they ever joined.
  const response = await call(router, {
    method: "PUT",
    cookie: `${SESSION_COOKIE}=${id}`,
    body: JSON.stringify({ operators: ["999000000000000009"] }),
  });

  assert.equal(response.statusCode, 400);
});

test("a settings write is attributed in the change log", async () => {
  resetSessions();
  resetGuildState(GUILD);
  accessStore.resetGuildAccess(GUILD);
  const router = createDashboardRouter(accessClient());
  const id = createSession({ userId: OWNER_ID, username: "Owner", guilds: [{ id: GUILD }] });

  await call(
    router,
    { method: "PATCH", cookie: `${SESSION_COOKIE}=${id}`, body: JSON.stringify({ player: { autoplay: true } }) },
    url(`/api/dashboard/guilds/${GUILD}/settings`)
  );

  const entry = accessStore.getChangeLog(GUILD, 10)[0];
  assert.equal(entry.username, "Owner");
  assert.equal(entry.section, "player");
  assert.equal(entry.field, "autoplay");
  assert.equal(entry.from, "off");
  assert.equal(entry.to, "on");
});
