const { randomBytes } = require("node:crypto");
const { version: packageVersion } = require("../../package.json");
const Log = require("../logs/log");
const { consumeRateLimit } = require("../security/rateLimit");
const statsStore = require("../stats/store");
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
const STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  if (!result.allowed) {
    throw Object.assign(new Error("Too many requests. Try again shortly."), { statusCode: 429 });
  }
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

    if (request.method === "GET" && url.pathname === `${PREFIX}/login`) {
      enforceRateLimit(request, "login", 20, 60_000);
      if (!config.clientId || !config.clientSecret) {
        throw Object.assign(new Error("The dashboard OAuth credentials are not configured."), { statusCode: 503 });
      }
      const state = randomBytes(16).toString("hex");
      return redirect(response, buildAuthorizeUrl(state, config), {
        "Set-Cookie": serializeStateCookie(state, { secure: config.secure, maxAgeMs: STATE_TTL_MS }),
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
          serializeSessionCookie(sessionId, { secure: config.secure, maxAgeMs: SESSION_COOKIE_MAX_AGE_MS }),
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

    if (request.method === "GET" && url.pathname === `${PREFIX}/public/stats`) {
      enforceRateLimit(request, "stats", 120, 60_000);

      let songsPlayed = 0;
      let msPlayed = 0;
      try {
        const global = statsStore.getGlobalStats();
        songsPlayed = Number(global?.songsPlayed) || 0;
        msPlayed = Number(global?.msPlayed) || 0;
      } catch {
        songsPlayed = 0;
        msPlayed = 0;
      }

      return sendJson(response, 200, {
        ok: true,
        instance: {
          servers: client?.guilds?.cache?.size ?? 0,
          songsPlayed,
          msPlayed,
          uptimeMs: Math.floor(process.uptime() * 1000),
          version: packageVersion,
        },
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
