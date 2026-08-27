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
