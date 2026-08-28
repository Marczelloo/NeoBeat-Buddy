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
DASHBOARD_TRUST_PROXY=0
```

In production set `DASHBOARD_TRUST_PROXY` to the number of proxies in front of
the gateway — `1` behind a single Cloudflare tunnel. See **Access control**
below for why.

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

The third server, **Test Server**, is deliberately blank: no logging set up, no
tickets, a flat equalizer and no listening history. The empty states are what
every new install sees first, so they have to be reachable without waiting for
a real fresh server.

The stub also refuses what the gateway refuses — turning tickets on with no
channel, clearing a log channel — because a mock that accepts more than the
server does teaches the UI a shape it will never be given.

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
| Equalizer | Preset | `/equalizer` |
| Equalizer | The fifteen bands | `/eqpanel` |
| DJ | DJ mode on/off | `/dj` |
| DJ | DJ role | `/dj` |
| DJ | Skip mode | `/dj` |
| DJ | Vote threshold | `/dj` |
| DJ | Strict mode | `/dj` |
| Announcements | Channel | `/setup announcements channel` |
| Announcements | Enabled | `/setup announcements enable` / `disable` |
| Server logs | Logging on/off | `/logs enable` / `disable` |
| Server logs | Each of the four categories | `/logs enable <category>` |
| Server logs | The channel each category writes to | — |
| Server logs | Which roles may read the logs | `/logs access` |
| Tickets | System on/off | `/ticket admin setup` / `disable` |
| Tickets | Notification channel | `/ticket admin setup` |
| Tickets | Ping role | `/ticket admin setup` |

Statistics is the one read-only section: it reports this server's listening
history and changes nothing.

### What the dashboard deliberately will not do

- **Create the log channels.** `/logs setup` builds a private category with
  four channels and needs Manage Channels. That is provisioning, not
  configuration, so the Server logs section reports that it has not run yet and
  sends you to the command. Everything else there becomes editable afterwards.
- **Moderation.** `/mod` is entirely actions — kick, ban, timeout, purge — with
  no stored per-guild configuration, so there is nothing for a settings page to
  hold.
- **Per-member preferences.** `/setup source me` and saved playlists belong to
  a member, not a server, and this dashboard is scoped to servers you
  administer.

### Two settings that are not simply stored

Most of the page writes a value and stops. Two do more, because storing alone
would leave the record disagreeing with reality:

- **Log access roles** edit the Discord permission overwrites on the log
  category and every channel in it, exactly as `/logs access` does. A role is
  recorded only once its overwrite actually landed; if Discord refuses, the
  save reports it and the role is not listed as having access.
- **The equalizer** is persisted as the server's stored filters *and* pushed to
  a running player when there is one. The stored copy is what `playback.js`
  restores on the next player, so a change made while nothing is playing is
  still the change that takes effect.

A write that partly succeeds returns warnings alongside the saved settings, and
the panel shows them under the section heading rather than claiming a clean
save.

## Access control

A visitor sees a server only when both are true: they hold **Administrator**
on it, and the bot is in it.

The OAuth `guilds` scope only decides what the server rail renders. Every read
and every write of a guild's settings independently re-verifies the member
against the live Discord client — `assertGuildAdmin` fetches the member and
checks owner-or-Administrator on each request. A permission claim from the
browser is never trusted, and the guild list captured at login is never
sufficient on its own. An admin demoted after signing in is refused on their
next request, because the bot runs with the `GuildMembers` intent and Discord
pushes role changes into the member cache.

### What this means in practice

**Administrator is the whole gate.** Anyone who holds it on a server can change
every setting on this page. That is the same authority `/setup`, `/dj` and
`/logs` already require in Discord, so the dashboard grants nothing new — but
if a server hands Administrator out widely, it has handed out the dashboard
too. There is currently no owner-only mode and no per-section restriction.

**Nothing records who changed what.** The Activity keeps an action feed; the
dashboard does not. With several administrators there is no way to attribute a
change after the fact.

Both are deliberate omissions rather than oversights, and both are cheap to add
if a server needs them.

### Request hardening

| Concern | How it is handled |
|---|---|
| Session theft | Session id is 32 random bytes from `randomBytes`, held in an `httpOnly`, `SameSite=Lax` cookie. Discord access tokens never reach the browser. |
| `Secure` flag | Derived from the scheme of `DASHBOARD_PUBLIC_URL`. Terminating TLS at a proxy while leaving that on `http://` would ship the session id in clear, so the gateway warns about exactly that at startup. |
| OAuth CSRF | A single-use `state` cookie, compared on the callback. |
| Write CSRF | `SameSite=Lax` keeps the cookie off cross-site writes, and `PATCH` additionally requires an `Origin` matching `DASHBOARD_PUBLIC_URL`. No state-changing `GET` exists, which is what `Lax` would otherwise allow. |
| Request flooding | Per-address buckets: 20/min on login and callback, 240/min on authenticated reads, 60/min on writes, 120/min on the public stats endpoint. |
| Address spoofing | `X-Forwarded-For` is read **only** when `DASHBOARD_TRUST_PROXY` says how many proxies are in front; otherwise the socket peer is used. Left at `0` behind a proxy, every visitor shares one bucket and any one of them can lock out the rest — the gateway warns when the deployment looks proxied. Trusting the header unconditionally would let anyone rotate it and never be limited at all. |
| Body size | Request bodies are capped at 32 KB. |

### What the public endpoint exposes

`/api/dashboard/public/stats` needs no session — the landing page reads it. It
returns aggregates only: server count, tracks played, listening time, unique
listener *count*, session totals, uptime and version. No user, server or track
identifiers. If a deployment would rather not publish even that, set
`DASHBOARD_ENABLED=false`, which disables the whole surface including sign-in.

## Sessions

Sessions are held in memory in the bot process. The browser stores only an
opaque session id in an `httpOnly`, `SameSite=Lax` cookie; Discord access
tokens never reach the browser. Restarting the bot ends all sessions and
signs everyone out — a deliberate simplification, not an oversight. Moving
them to a JSON store is an isolated change to `helpers/dashboard/sessions.js`.
