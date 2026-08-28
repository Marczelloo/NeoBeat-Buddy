# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The Discord bot is Node.js with discord.js and Poru/Lavalink. The Discord Activity is a React + Vite surface in `activity/`. The public web surfaces — marketing site and server dashboard — are a separate React + Vite app in `web/`, sharing the Obsidian design tokens with the Activity but built and deployed independently. All three are served by, or authenticate against, the bot-owned gateway in `helpers/activity/server.js`.

## Users

Three distinct audiences, in order of how much design attention each surface owes them:

- **Listeners** — Discord users who listen together in a server voice channel and need to control shared music without leaving Discord. They use the Activity.
- **Server admins** — people with Administrator permission on a Discord server that MewBit is in. They configure how the bot behaves for their server. They use the dashboard, and today are forced through slash commands instead.
- **Operators / self-hosters** — technically capable people evaluating whether to deploy MewBit on their own infrastructure. They read the marketing site and decide whether to clone the repo.

## Product Purpose

MewBit is a self-hosted Discord music bot. It plays shared music in voice channels with multi-source search, autoplay, DJ controls, lyrics, filters, an equalizer, and playlists. The Activity gives the listening group a visual player. The dashboard gives server admins a real settings surface instead of memorizing slash-command syntax. The marketing site gives an evaluating operator enough evidence to decide to deploy it.

Success: an operator deploys MewBit without asking questions, and their server admins configure it without reading docs.

## Positioning

MewBit is deployed, not subscribed. The operator owns the instance, the data files, and the Lavalink nodes — there is no hosted tier to be rate-limited by, no premium wall over the equalizer or audio quality, and no vendor who can turn the bot off. A hosted competitor cannot truthfully claim that.

## Operating Context

- The bot runs on infrastructure the operator controls, alongside Lavalink, in Docker or directly on Node.
- The Activity runs inside Discord as an Embedded App, while the bot is connected to a voice channel.
- The marketing site and dashboard run in an ordinary browser, outside Discord.
- Dashboard access is per-server: an admin signs in with Discord, sees only servers they administer that the bot is also in, and edits that server's settings.
- Settings written from the dashboard take effect on the same running bot that slash commands write to. The two paths are not allowed to diverge.
- The existing message embed remains available as a fallback and entry point.

## Capabilities and Constraints

- The bot already owns Discord commands, queue state, source-aware search, autoplay, lyrics, filters, equalizer settings, playlist storage, and statistics.
- Guild settings persist in flat JSON stores: `helpers/data/guildState.json` (player channel, default source, announcements channel and toggle, autoplay, 24/7 radio) and `helpers/data/dj.json` (DJ mode enabled, DJ role, skip mode, vote threshold, strict mode). These are the settings the dashboard exposes; the dashboard adds no settings the bot does not already implement.
- The Activity must control the existing player instead of creating a second playback implementation.
- The dashboard must gate on real Discord permissions checked server-side. A client-side permission claim is never sufficient.
- The browser must never receive the Discord bot token or client secret.
- The dashboard requires a Discord OAuth2 web flow with `identify` and `guilds` scopes, which is a different flow from the Activity's embedded SDK authentication.
- Hosting, HTTPS exposure, Discord Embedded App configuration, and OAuth redirect URIs are per-operator deployment decisions. The product must not assume a single canonical domain.

## Brand Commitments

- The product name is MewBit.
- **The Educational & Research Licence is a deliberate, confirmed choice, not an oversight.** The owner keeps it restrictive because MewBit resolves audio through YouTube, Spotify and Deezer in ways that may conflict with those services' terms, and a permissive licence would invite public deployments that carry that risk onward. Public surfaces must not imply the project is open source, must not encourage public-server or commercial deployment, and must state the third-party terms reality plainly. Any future relicensing is the owner's decision alone.
- The established identity is a neon cyberpunk anime catgirl with music-player energy.
- `activity/redesigns/obsidian-brandboard.html` is the binding design specification for application chrome: near-black base, Hanken Grotesk and JetBrains Mono, white primary CTAs, and color used only to carry meaning — cyan for live and focus, magenta for like, violet for autoplay provenance.
- The dashboard follows the Obsidian specification strictly, because it is an Operate surface where restraint is correctness.
- The marketing site is permitted more expression than the Obsidian bans allow, but must remain recognizably the same product: same typefaces, same near-black ground, same semantic use of cyan, magenta, and violet.
- Copy can be playful and anime or gaming aware, but control labels and errors must stay unambiguous.

## Evidence on Hand

- Existing bot implementation in `index.js`, `commands/`, `events/`, and `helpers/`.
- Existing Lavalink integration and player state in `helpers/lavalink/`.
- Existing Activity frontend in `activity/src/` and its gateway in `helpers/activity/server.js`.
- Existing settings stores in `helpers/guildState.js` and `helpers/dj/store.js`, and the slash commands that write them in `commands/utility/setup.js` and `commands/music/dj.js`.
- Existing statistics store in `helpers/stats/` — the source for any live numbers shown publicly.
- Existing automated tests in `tests/` covering search, autoplay, queue ordering, lyrics, filters, volume, and branding.
- Verifiable capability inventory drawn from the repository: Deezer FLAC playback, multi-source search across Deezer, YouTube, Spotify, and SoundCloud, autoplay v3, DJ mode with vote skipping, equalizer presets with custom user presets, synced lyrics, filter presets, playlists with URL import, and per-guild statistics.
- **No fabricated proof.** There are no testimonials, no customer logos, no adoption figures, no benchmarks, and no press. None may be invented.
- Live statistics shown on the marketing site come from the instance serving that page and must be labeled as such. They must degrade to a designed empty state when counts are trivial and when the gateway is unreachable.

## Product Principles

- One playback authority: the bot and Lavalink remain the source of truth.
- One settings authority: the dashboard and slash commands write the same stores, and neither becomes a privileged path.
- Shared state is visible before actions are taken.
- Permission is proven server-side, never asserted by the client.
- Personality belongs in the atmosphere and copy, never at the cost of control clarity.

## Accessibility & Inclusion

All surfaces must support keyboard focus, readable contrast, labelled controls, reduced motion, responsive layouts, and clear loading, empty, error, and unauthorized states. The marketing site's motion is decorative and must be fully disabled under `prefers-reduced-motion` without losing content.
