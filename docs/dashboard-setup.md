# MewBit web — landing page and dashboard setup

The `web/` app serves two surfaces:

- `/` — the public landing page.
- `/dashboard` — per-server settings for Discord administrators.

Both talk to the bot's existing gateway (`helpers/activity/server.js`) under
`/api/dashboard/*`. The bot must be running for either to show live data.

## 1. Configure the Discord application

The dashboard uses a standard OAuth2 authorization-code flow, which is
different from the Activity's embedded-SDK flow. In the
[Discord Developer Portal](https://discord.com/developers/applications),
open your application → **OAuth2** and add a redirect URI matching where you
serve the site:

| Environment | Redirect URI |
|---|---|
| Local development | `http://localhost:8787/api/dashboard/callback` |
| Production | `https://your-domain.example/api/dashboard/callback` |

The value must match `DASHBOARD_OAUTH_REDIRECT_URI` exactly, including scheme,
port and trailing path. Discord rejects the sign-in otherwise.

Scopes are requested at sign-in time and do not need configuring: `identify`
and `guilds`.

## 2. Environment

Add to your `.env` (see `.env-example`):

```
DASHBOARD_ENABLED=true
DASHBOARD_PUBLIC_URL=http://localhost:5174
DASHBOARD_OAUTH_REDIRECT_URI=http://localhost:8787/api/dashboard/callback
DASHBOARD_SESSION_TTL_MS=604800000
```

`CLIENT_ID` and `DISCORD_CLIENT_SECRET` are already required by the Activity
and are reused here.

`DASHBOARD_PUBLIC_URL` is the origin the browser loads the site from. It is
used for the post-login redirect and for the write-origin check, so it must be
the real public origin in production.

## 3. Run it

```bash
pnpm web:dev
```

The dev server listens on `http://127.0.0.1:5174` and proxies `/api` to the
gateway at `http://127.0.0.1:8787`. Override with `VITE_WEB_PORT` and
`VITE_DASHBOARD_GATEWAY_URL`.

Build for production:

```bash
pnpm web:build
```

Output lands in `web/dist`. Serve it as static files behind the same origin as
the gateway, or on a separate host with `/api` proxied to the gateway — the
OAuth redirect URI differs between those two layouts, so pick one and set
`DASHBOARD_OAUTH_REDIRECT_URI` to match.

## 4. Working on the dashboard without Discord

The dashboard needs a real Discord session to show anything. For UI work
without one, append `?mock=1` in development:

```
http://127.0.0.1:5174/dashboard?mock=1
```

This installs a stub API with three fake servers and a full settings payload.
It lives in `web/src/devMock.js` behind `import.meta.env.DEV`, so it is
removed entirely from production builds.

## What the dashboard can change

Every setting writes through the same store functions the slash commands use
(`updateGuildState`, `djStore.setGuildConfig`), so the dashboard and the
commands cannot drift apart.

| Section | Setting | Equivalent command |
|---|---|---|
| Player | Player channel | `/setup player channel` |
| Player | Autoplay | `/autoplay` |
| Player | 24/7 radio | `/247` |
| Source | Default search source | `/setup source server` |
| DJ | DJ mode on/off | `/dj` |
| DJ | DJ role | `/dj` |
| DJ | Skip mode | `/dj` |
| DJ | Vote threshold | `/dj` |
| DJ | Strict mode | `/dj` |
| Announcements | Channel | `/setup announcements channel` |
| Announcements | Enabled | `/setup announcements enable` / `disable` |

## Access control

A visitor sees a server only when both are true: they hold **Administrator**
on it, and the bot is in it. The server list comes from the OAuth `guilds`
scope, but that list only renders the rail — every read and write of a
guild's settings re-verifies the member against the live Discord client on the
server side. A permission claim from the browser is never trusted.

## Sessions

Sessions are held in memory in the bot process. The browser stores only an
opaque session id in an `httpOnly`, `SameSite=Lax` cookie; Discord access
tokens never reach the browser. Restarting the bot ends all sessions and
signs everyone out — a deliberate simplification, not an oversight. Moving
them to a JSON store is an isolated change to `helpers/dashboard/sessions.js`.
