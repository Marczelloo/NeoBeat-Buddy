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
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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

test("the redirect uri derives from the public url so a deployment sets one value", () => {
  withEnv({ DASHBOARD_PUBLIC_URL: "https://mewbit.test", DASHBOARD_OAUTH_REDIRECT_URI: undefined }, () => {
    assert.equal(getDashboardConfig().redirectUri, "https://mewbit.test/api/dashboard/callback");
  });
});

test("a trailing slash or stray whitespace cannot reach Discord's byte-for-byte comparison", () => {
  // Discord answers a mismatch with nothing but "invalid redirect_uri", so an
  // invisible character in a .env line is otherwise very expensive to find.
  withEnv({ DASHBOARD_PUBLIC_URL: "  https://mewbit.test/  ", DASHBOARD_OAUTH_REDIRECT_URI: undefined }, () => {
    const config = getDashboardConfig();
    assert.equal(config.publicUrl, "https://mewbit.test");
    assert.equal(config.redirectUri, "https://mewbit.test/api/dashboard/callback");
  });

  withEnv({ DASHBOARD_OAUTH_REDIRECT_URI: " https://mewbit.test/api/dashboard/callback/ " }, () => {
    assert.equal(getDashboardConfig().redirectUri, "https://mewbit.test/api/dashboard/callback");
  });
});

test("an explicit redirect uri still overrides the derived one", () => {
  withEnv({
    DASHBOARD_PUBLIC_URL: "https://mewbit.test",
    DASHBOARD_OAUTH_REDIRECT_URI: "https://gateway.mewbit.test/api/dashboard/callback",
  }, () => {
    assert.equal(getDashboardConfig().redirectUri, "https://gateway.mewbit.test/api/dashboard/callback");
  });
});

test("the authorize url and the token exchange send the identical redirect uri", async () => {
  // These must match byte for byte or Discord rejects the exchange after the
  // user has already approved, which looks like a server fault rather than a
  // configuration one. `withEnv` is synchronous, so the config is read inside
  // it and the awaited work happens outside — awaiting in there would restore
  // the environment before the assertions ran.
  const config = withEnv(
    { DASHBOARD_PUBLIC_URL: "https://mewbit.test", CLIENT_ID: "123", DISCORD_CLIENT_SECRET: "shh" },
    () => getDashboardConfig()
  );

  const authorize = new URL(buildAuthorizeUrl("state-token", config));

  let exchangedBody = null;
  await exchangeCode("code-token", config, async (_url, init) => {
    exchangedBody = new URLSearchParams(init.body);
    return { ok: true, json: async () => ({ access_token: "token" }) };
  });

  assert.equal(config.redirectUri, "https://mewbit.test/api/dashboard/callback");
  assert.equal(authorize.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(exchangedBody.get("redirect_uri"), config.redirectUri);
});

test("the dashboard can be switched off", () => {
  withEnv({ DASHBOARD_ENABLED: "false" }, () => {
    assert.equal(getDashboardConfig().enabled, false);
  });
});

test("a trailing slash on the public url is trimmed", () => {
  withEnv({ DASHBOARD_PUBLIC_URL: "https://mewbit.test/" }, () => {
    assert.equal(getDashboardConfig().publicUrl, "https://mewbit.test");
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
