# MewBit Web — Landing Page and Server Dashboard

Date: 2026-08-27
Status: awaiting review

## Scope

A new `web/` application containing two surfaces:

1. **Landing page** (Persuade) — a public page that convinces a technically capable operator to deploy MewBit on their own infrastructure.
2. **Server dashboard** (Operate) — an authenticated surface where a Discord server administrator configures the bot for a server the bot is already in.

Plus the backend to support them: a Discord OAuth2 web flow and guild-settings endpoints added to the existing bot-owned gateway.

Out of scope: any new bot capability. The dashboard exposes only settings the bot already implements.

## Confirmed decisions

| Decision | Answer |
|---|---|
| App shape | New `web/` Vite app, separate from `activity/` |
| Backend depth | Full real wiring — OAuth, sessions, permission gating, persistence |
| Settings surface | Only settings the bot supports today |
| Landing CTA | Self-host / open source; primary action is the repository |
| Identity | Obsidian governs both; the landing page may be louder than the brandboard's bans allow, the dashboard may not |
| Proof | Live stats from this instance + the real, verifiable feature inventory. No fabricated metrics or testimonials. |
| Build path | Code-led (no image generation available this session) |

## Locked visual directions

Both surfaces inherit the Obsidian Motion world from `activity/redesigns/obsidian-brandboard.html`. Neither round chose a new identity; both chose composition.

### Landing — Command Palette (seed `ab48e825`, dealt 5/4/2, lead locked)

The page is driven by MewBit's own slash-command surface. A live command line sits at optical center with a blinking caret and ghost text cycling real commands. Below it, a response canvas renders what that command actually returns — a queue, an EQ curve, a DJ vote in progress. Typing or clicking swaps the canvas. Reading the page is already using the bot. The primary action is the last entry in the command index: deploy your own.

Raises carried in from declined challengers:

- **From Four-Shade Field** — a blinking caret always marks where to act, and selection inverts the row outright rather than tinting it.
- **From Iridescent Cloud Edge** — color stays at hairline edges and active-state marks only; the text field itself stays achromatic. This is the governor on "the landing page may be louder": louder means scale, motion, and density, not colored fields.

Honest risk on record: a visitor who does not realize the line is interactive sees an empty page. The caret and ghost text must carry that discovery within the first second, and the page must be fully readable and navigable without ever typing.

### Dashboard — Server Rail (seed `2e58cda9`, dealt 7/6/1, pick card locked)

A narrow icon rail of servers on the far left, a section list beside it (Player, Source, DJ, Announcements), and the settings themselves in the main column at generous measure. Each control states what it changes in the bot's own terms. Save state persists at the foot of the column.

This was my top-ranked candidate and the user's choice over the dealt lead. Its recorded risk is that nothing about it will be memorable — accepted deliberately, because in Operate mode the affordance this audience already operates fluently in Discord itself is worth more than novelty.

Disciplines retained from the round regardless of which card won, because they are correct for this surface:

- A saved value confirms as a visible event, not a silent repaint. The admin sees the write land on the live bot.
- Interdependent settings show their consequence rather than failing validation after the fact: strict mode does nothing without a DJ role, and vote threshold is inert unless skip mode includes voting. These are surfaced inline, at the control.

## Architecture

### Frontend — `web/`

React 19 + Vite 8, matching `activity/`'s versions. Adds `react-router-dom` for real routes; `motion` v13 for the landing page's motion, already a dependency in the sibling app.

```
web/
  index.html
  package.json
  vite.config.js
  src/
    main.jsx
    App.jsx
    tokens.css          # Obsidian tokens, single source shared in spirit with activity/src/styles.css
    api.js              # fetch wrapper, credentials: include
    landing/
      Landing.jsx
      CommandLine.jsx
      ResponseCanvas.jsx
      responses/        # one module per command the canvas can render
      LiveStats.jsx
    dashboard/
      Dashboard.jsx
      ServerRail.jsx
      SectionList.jsx
      sections/
        PlayerSection.jsx
        SourceSection.jsx
        DjSection.jsx
        AnnouncementsSection.jsx
      SaveState.jsx
      states/           # loading, unauthorized, no-shared-servers, gateway-down
```

Routes: `/` (landing), `/dashboard` (server picker / first server), `/dashboard/:guildId/:section`, `/login`, `/logout`.

### Backend — new module, existing gateway

`helpers/activity/server.js` is already past a thousand lines. Rather than growing it, dashboard routes live in a new `helpers/dashboard/` module and the existing `handleRequest` delegates any `/api/dashboard/*` path to it. This keeps the change additive and the existing Activity paths untouched.

```
helpers/dashboard/
  routes.js        # request router for /api/dashboard/*
  oauth.js         # authorize URL, code exchange, token handling
  sessions.js      # server-side session store, TTL, cookie helpers
  permissions.js   # admin verification against the live client
  settings.js      # read/write projection over guildState + djStore
```

### Authentication

A standard OAuth2 authorization-code web flow, distinct from the Activity's embedded SDK flow. Scopes: `identify` and `guilds`.

| Route | Behavior |
|---|---|
| `GET /api/dashboard/login` | Generates a random `state`, stores it in a short-lived httpOnly cookie, redirects to Discord's authorize endpoint. |
| `GET /api/dashboard/callback` | Verifies `state`, exchanges the code, fetches the user and their guilds, creates a server-side session, sets a session cookie, redirects to `/dashboard`. |
| `POST /api/dashboard/logout` | Destroys the session and clears the cookie. |
| `GET /api/dashboard/me` | Returns the user and the guild list. |
| `GET /api/dashboard/guilds/:id/settings` | Returns that guild's settings plus the channel and role options needed to render the pickers. |
| `PATCH /api/dashboard/guilds/:id/settings` | Validates and writes. |
| `GET /api/dashboard/public/stats` | Unauthenticated. Instance stats for the landing page. |

**Sessions** are server-side, held in an in-memory `Map` with a TTL, matching the pattern already used for Activity sessions and the identity cache. The browser holds only an opaque random session id in an `httpOnly`, `SameSite=Lax`, `Secure` cookie. Discord access tokens never reach the browser. Sessions do not survive a bot restart; the user signs in again. This is a deliberate simplification, recorded here so it is not mistaken for an oversight.

**The guild list** is the intersection of two sets: guilds returned by Discord for this user where the `permissions` field carries `Administrator`, and guilds present in `client.guilds.cache`. Result: exactly the servers the user administers that the bot is also in — which is the rule requested.

**Authorization is re-verified server-side on every single guild-scoped request**, by fetching the member from the live client and checking `PermissionsBitField.Flags.Administrator` or guild ownership. The OAuth guild list is used for rendering the rail, never as the authority for a write. A client-side permission claim is never sufficient.

**CSRF**: mutations are `PATCH`/`POST` with a JSON content type, an `Origin` check against the configured public URL, and a `SameSite=Lax` cookie. Rate limiting reuses the existing `consumeRateLimit`.

### Settings projection

The dashboard writes exclusively through the existing store functions — `updateGuildState` and `djStore.setGuildConfig` — never to the JSON files directly. Both stores already normalize and schedule their own persistence, so slash commands and the dashboard converge on the same code path and cannot diverge.

| Section | Field | Store | Existing command |
|---|---|---|---|
| Player | player / command channel | `guildState.playerChannel` | `/setup player channel` |
| Player | autoplay | `guildState.autoplay` | `/autoplay` |
| Player | 24/7 radio | `guildState.radio247` | `/247` |
| Source | default search source | `guildState.defaultSource` | `/setup source server` |
| Announcements | channel | `guildState.announcementChannel` | `/setup announcements channel` |
| Announcements | enabled | `guildState.announcementsEnabled` | `/setup announcements enable\|disable` |
| DJ | enabled | `dj.enabled` | `/dj` |
| DJ | role | `dj.roleId` | `/dj` |
| DJ | skip mode | `dj.skipMode` (`dj` / `vote` / `hybrid`) | `/dj` |
| DJ | vote threshold | `dj.voteThreshold` (0.1–1.0) | `/dj` |
| DJ | strict mode | `dj.strictMode` | `/dj` |

### Landing page proof

`GET /api/dashboard/public/stats` returns real values from `statsStore.getGlobalStats()` and the live client: servers connected, tracks played, uptime, version. These are labeled as belonging to **this instance**, never presented as network-wide adoption. The page must render correctly and without embarrassment when the numbers are small, when the stats store is empty, and when the gateway is unreachable — all three are designed states, not error fallbacks.

Everything else on the page is the verifiable feature inventory drawn from the repository: Deezer FLAC playback, multi-source search across four providers, autoplay v3, DJ mode with vote skipping, equalizer presets with custom user presets, synced lyrics, filter presets, playlists with URL import, and per-guild statistics.

### Configuration

New environment variables, added to `.env-example`:

```
DASHBOARD_ENABLED=true
DASHBOARD_PUBLIC_URL=https://mewbit.example.com
DASHBOARD_OAUTH_REDIRECT_URI=https://mewbit.example.com/api/dashboard/callback
DASHBOARD_SESSION_TTL_MS=604800000
```

`CLIENT_ID` and `DISCORD_CLIENT_SECRET` are already configured for the Activity and are reused.

## Error and edge states

Each is designed, not defaulted:

- Not signed in
- Signed in, but shares no servers with the bot
- Signed in, administers servers, but the bot is in none of them
- Guild selected, but the bot was removed from it mid-session
- Gateway unreachable (both surfaces)
- Save conflict — the setting changed via slash command while the dashboard was open
- Reduced motion, on both surfaces

## Testing

The repo uses `node --test` with tests under `tests/`. New coverage:

- `tests/helpers/dashboard/permissions.test.js` — admin detection, owner fallback, non-admin rejection, bot-absent rejection.
- `tests/helpers/dashboard/sessions.test.js` — creation, TTL expiry, destruction.
- `tests/helpers/dashboard/settings.test.js` — validation and clamping for every field above, especially `voteThreshold` bounds and `skipMode` allow-list, and that writes route through the stores.
- `tests/helpers/dashboard/routes.test.js` — unauthenticated rejection, cross-guild access rejection, origin check.

Frontend is verified by the finish review's screenshot pass at desktop and mobile, plus the mechanical detector.

## Open decisions

- **Deployment topology** — whether `web/` is served as static files by the gateway itself or by a separate static host with the gateway behind a path prefix. Both work; the OAuth redirect URI differs. To decide at handoff, not now.
- **Session persistence across restarts** — in-memory is the recorded choice. Moving to a JSON store later is a small, isolated change to `sessions.js`.
