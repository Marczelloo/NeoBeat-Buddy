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
| Local development | `http://localhost:5174/api/dashboard/callback` |
| Production | `https://your-domain.example/api/dashboard/callback` |

Add **both** rows now, not one at a time. Discord accepts several redirect
URIs on one application and picks by exact match at sign-in, so registering
the local and production callbacks together means neither environment ever
has to touch the portal again.

The value must match `DASHBOARD_OAUTH_REDIRECT_URI` exactly, including scheme,
port and trailing path. Discord rejects the sign-in otherwise.

The local URI points at the Vite dev server, not at the gateway, because Vite
proxies `/api` through to it. That keeps the page, the sign-in and every API
call on one origin, which is what the write-origin check on `PATCH` compares
against — so browse the dashboard at `localhost:5174`, not `127.0.0.1:5174`.
Those are the same server but different origins, and only the first matches
`DASHBOARD_PUBLIC_URL`.

Scopes are requested at sign-in time and do not need configuring: `identify`
and `guilds`.

## 2. Environment

Add to your `.env` (see `.env-example`):

```
DASHBOARD_ENABLED=true
DASHBOARD_PUBLIC_URL=http://localhost:5174
DASHBOARD_SESSION_TTL_MS=604800000
```

`DASHBOARD_OAUTH_REDIRECT_URI` is intentionally absent: it derives from
`DASHBOARD_PUBLIC_URL`. Local and production then differ by that one
variable — production sets `DASHBOARD_PUBLIC_URL=https://your-domain.example`
and nothing else changes. Set the explicit variable only when the callback is
served somewhere other than the site origin.

Both values are trimmed and stripped of trailing slashes before use. Discord
compares the redirect URI byte for byte and reports a mismatch as nothing but
`invalid redirect_uri`, so a stray space in a `.env` line would otherwise be
invisible.

### Which URI is this deployment actually sending?

The bot prints it on every start, next to the gateway line:

```
MewBit dashboard ready http://localhost:5174
  redirect_uri=http://localhost:5174/api/dashboard/callback
  register this exact URI under OAuth2 in the Discord Developer Portal
```

Copy that string into the portal rather than retyping it. If sign-in fails
with `invalid redirect_uri`, compare the portal entry against this line
first — that is the whole diagnosis, and Discord will not tell you which of
the two it disliked.

`CLIENT_ID` and `DISCORD_CLIENT_SECRET` are already required by the Activity
and are reused here.

`DASHBOARD_PUBLIC_URL` is the origin the browser loads the site from. It is
used for the post-login redirect and for the write-origin check, so it must be
the real public origin in production.

## 3. Run the bot stack locally

The dashboard reads and writes through the running bot, so the bot has to be
up before either surface shows anything. `docker-compose.local.yml` is a
development overlay for that; it is never loaded automatically, so the base
file the Raspberry Pi reads stays untouched.

```bash
pnpm local:up
```

It differs from the base compose file in three ways, all of them wrong to put
in the base file:

- The bot is **built from this checkout** instead of pulling the published
  arm64 image, so local changes are what actually runs.
- The gateway is published on **8787**, which is what `web/vite.config.js`
  proxies `/api` to. The base file keeps it on 8788 to stay clear of the
  dashboard runner on the Pi.
- `helpers/`, `commands/`, `events/` and `index.js` are **bind-mounted**, so a
  backend edit needs a restart rather than a rebuild:

```bash
pnpm local:restart
```

That is about seven seconds. `node_modules` is deliberately not mounted: the
host tree is installed for Windows, and the image's own copy is the one that
matches the container runtime. Changing a dependency does need `pnpm local:up`
again.

`pnpm local:logs` follows the bot, `pnpm local:down` stops everything.

## 4. Run the web app


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

## 5. Working on the dashboard without Discord

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
