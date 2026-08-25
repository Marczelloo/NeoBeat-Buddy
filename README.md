# MewBit

MewBit is a Discord music bot with a shared listening **Discord Activity**. It uses Lavalink for playback, supports multiple music providers, keeps the player message and Activity in sync, and includes playlists, lyrics, effects, queue controls, moderation tools, diagnostics, and a DJ-style autoplay system.

> Keep tokens, cookies, API keys, and Discord client secrets out of Git. Start from [`.env-example`](.env-example) and keep your real `.env*` files local to the machine.

## Contents

- [What is included](#what-is-included)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Discord setup](#discord-setup)
- [Discord Activity](#discord-activity)
- [Music, queue, and autoplay](#music-queue-and-autoplay)
- [Slash commands](#slash-commands)
- [Deployment](#deployment)
- [Testing and diagnostics](#testing-and-diagnostics)
- [Project layout](#project-layout)

## What is included

### Music player

- Lavalink v4 playback in voice channels.
- YouTube, SoundCloud, Deezer, and Spotify-aware searching, plus direct provider URLs.
- A configurable default search source for a server or an individual user.
- Now-playing embed with buttons, progress, volume, queue, lyrics, and filters.
- Cross-provider loudness compensation, configurable per source.
- Recovery snapshots preserve the current track, queue, position, volume, loop mode, and filters through unexpected Discord/Lavalink disconnects. The bot restores them only after a user starts playback again; it never silently rejoins voice after being kicked.
- Queue history, replay, export, shuffle, loop, previous, seek, and 24/7 mode.

### Smart autoplay / DJ mode

- Pre-fetches compatible tracks before the queue runs dry.
- Uses the V3 DJ selector: a stable manual-session anchor, Last.fm related tracks, nearby album cuts, and YouTube Mix only as a constrained fallback. Broad catalog searches do not enter its decision pool.
- Preserves a fitting same-artist run when it has a strong relationship signal, but caps it at three consecutive tracks and caps same-album runs at two tracks.
- Scores the small trusted pool with canonical track identity, Last.fm similarity, anchor/current genre-family compatibility, and session/exposure memory.
- Rejects alternate uploads of tracks that have already appeared, including the same song from a different provider; ISRC is used when available and normalized artist/title identity remains the fallback.
- Avoids loops, over-repetition, and weak fallback results while still allowing a fitting artist to return after a sensible cooldown.
- Keeps tempo styles such as nightcore, slowed, and sped-up available as valid autoplay lanes, while requiring remix/live/acoustic/cover variants to match the current version lane.
- Uses direct YouTube Mix candidates only as a constrained, score-gated fallback for tracks with insufficient metadata (for example niche or meme uploads), rather than broad unrelated search.
- Excludes album skits, interludes, short intros/outros, transitions, and streams from autoplay candidates while still allowing a user to play them manually.
- Places manually queued tracks ahead of autoplay tracks; a manually added track goes after other manual items and before the autoplay tail.
- Optional AI DJ mode is the primary music director. It uses fast `gpt-5.6-luna` with the first user-selected track as a durable anchor, a longer memory of user-picked tracks, recurring artists and albums, the current track, the autoplay trail, the pending manual queue, and a compact catalog of already provider-verified candidates. It prefers that playable catalog but may discover two additional recordings. Open proposals resolve through YouTube/YouTube Music, Deezer, SoundCloud, then Spotify; every resolved result is rechecked for mirror, version, skip, album, artist, and repeat safety before it can be queued. V3 remains a constrained fallback only when the AI plan is unavailable, invalid, low confidence, or cannot be resolved.

### Discord Activity

- A real Discord Activity, not a replacement player embed.
- Shared room state for people in the same voice context.
- Search with source labels, queue editing, playback controls, volume/mute, lyrics, playlists, filters, and a 15-band EQ.
- Full layout, compact/minimized view, loading state, and live synchronization with the bot.

### Server utilities

- DJ role and vote-to-skip controls.
- Configurable player and announcement channels.
- Per-server logging, ticket system, moderation commands, custom embeds, activity/health metrics, and listening statistics.

## Requirements

- Node.js **20 or newer**
- pnpm **10 or newer**
- Docker and Docker Compose (recommended for Lavalink and production)
- A Discord application and bot token
- A Discord server where you can manage the bot and slash commands

For the full experience, configure at least YouTube credentials and a Last.fm API key. Spotify, Deezer, Genius, and SoundCloud access are optional but improve provider coverage and metadata.

## Quick start

### 1. Install dependencies

```bash
pnpm install
pnpm --dir activity install
```

### 2. Create local configuration

On PowerShell:

```powershell
Copy-Item .env-example .env.dev
```

On macOS/Linux:

```bash
cp .env-example .env.dev
```

Fill in the required values in `.env.dev`. For a local Lavalink container, keep `LAVALINK_HOST=127.0.0.1`.

### 3. Start Lavalink

```bash
pnpm lavalink:dev
```

### 4. Register slash commands

```bash
pnpm deploy:dev
```

Run this again whenever slash-command names, options, or descriptions change.

### 5. Start the bot

```bash
pnpm start:dev
```

The bot is ready when it logs in to Discord and connects to Lavalink. Join a voice channel and run `/play`.

## Configuration

All secrets belong in `.env`, `.env.dev`, or `.env.prod`—never in this repository.

### Required

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal. |
| `CLIENT_ID` | Discord application ID. |
| `LAVALINK_HOST` | `127.0.0.1` locally; `lavalink` inside the production Compose network. |
| `LAVALINK_PORT` | Lavalink port, normally `2333`. |
| `LAVALINK_PASSWORD` | Password shared by the bot and Lavalink. |

### Music providers and metadata

| Variable | Required? | Purpose |
| --- | --- | --- |
| `YOUTUBE_PO_TOKEN` | Recommended | Improves YouTube access. |
| `YOUTUBE_VISITOR_DATA` | Recommended | YouTube session metadata paired with the PO token. |
| `YOUTUBE_REFRESH_TOKEN` | Optional | OAuth refresh token for restricted/age-gated YouTube access. |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Optional | Spotify metadata, playlists, and resolving support. |
| `SPOTIFY_SP_DC` | Optional | Spotify web session cookie where required by the resolver. Treat as a secret. |
| `DEEZER_ARL_TOKEN` | Optional | Deezer access cookie. Treat as a secret. |
| `DEEZER_MASTER_KEY` | Optional | Deezer resolver configuration; the default is supplied in the example. |
| `AUTOPLAY_DEEZER_METADATA` | `true` | Uses Deezer's public catalog metadata as a Spotify-independent autoplay signal. It can provide BPM, gain, ISRC, and release data when available. |
| `GENIUS_API_KEY` | Optional | Better lyrics lookup coverage. |
| `LASTFM_API_KEY` | Strongly recommended for autoplay | Similar-artist data and tags for DJ mode. |
| `LASTFM_APPLICATION_NAME` / `LASTFM_SHARED_SECRET` | Optional | Application metadata for Last.fm integrations. |

Spotify links resolve their catalog metadata first, then play a verified YouTube mirror: ISRC search is preferred, followed by title and artist. Deezer is not used as Spotify's primary audio mirror because its media endpoint can reject otherwise valid recordings for licensing or regional-rights reasons. If the primary mirror fails, MewBit retries only a candidate with matching title, artist, requested version, duration, and (when both sources provide it) ISRC; it skips the track rather than silently playing a different song.

If a provider requires browser cookies, obtain them from an account you control and store them only on the host. The production Compose file mounts `helpers/lavalink/youtube-cookies.txt` for Lavalink when that file exists. Do not commit it.

### Playback and autoplay

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEFAULT_VOLUME` | `50` | Initial player volume (0–100). |
| `INACTIVITY_TIMEOUT_MS` | `300000` | Disconnect after this many idle milliseconds. |
| `TRACK_START_TIMEOUT_MS` | `15000` | Retry a queued item through verified fallbacks when Lavalink never emits `TrackStart`. |
| `PROGRESS_UPDATE_INTERVAL_MS` | `0` | Player-message update interval; `0` uses the built-in behavior. |
| `LOUDNESS_NORMALIZATION` | `true` | Enables source-aware playback gain compensation. |
| `LOUDNESS_<SOURCE>_DB` | provider default | Optional gain offset for a provider, e.g. `LOUDNESS_SOUNDCLOUD_DB=-3`. |
| `PLAYER_RECOVERY_MAX_AGE_MS` | `7200000` | How long an unexpected-disconnect snapshot is eligible for restoration after a user explicitly resumes playback. |
| `SEARCH_CACHE_MAX_ENTRIES` | `240` | Maximum cached Activity/autocomplete search entries; old entries are evicted first. |
| `AUTOPLAY_HISTORY_LIMIT` | `80` | Recent autoplay reservations remembered for hard duplicate prevention. |
| `AUTOPLAY_V3` | `true` | Uses the simpler trusted-source DJ selector. Set to `false` only to temporarily roll back to the legacy scorer. |
| `AUTOPLAY_V3_MAX_ALBUM_STREAK` | `2` | Maximum consecutive tracks from one album before V3 requires a different album. |
| `AUTOPLAY_V3_MAX_ARTIST_STREAK` | `3` | Maximum consecutive tracks by one artist before V3 requires a different artist. |
| `AI_DJ_ENABLED` | `false` | Enables OpenAI as the primary autoplay music director; V3 is retained as a safe playback fallback. |
| `OPENAI_API_KEY` | — | Secret API key for the OpenAI Responses API. Keep it only in local/server `.env` files. |
| `AI_DJ_MODEL` | `gpt-5.6-luna` | Fast Responses API model used for structured AI DJ plans. |
| `AI_DJ_REASONING_EFFORT` | `low` | GPT-5.6 reasoning depth; `low` keeps autoplay decisions responsive. |
| `AI_DJ_TIMEOUT_MS` | `12000` | Maximum AI DJ wait before falling back to V3. Planning runs in parallel with provider fallback collection. |
| `AI_DJ_CACHE_TTL_MS` | `300000` | Caches an identical sanitized listening context to avoid duplicate API calls. |
| `AI_DJ_MAX_PROPOSALS` | `8` | Maximum exact artist/title recordings in one AI DJ plan. |
| `AI_DJ_DIVERSITY_FIT_BAND` | `10` | Maximum AI fit-score drop accepted when softly rotating from a continuation to a bridge. |
| `AI_DJ_SKIP_DEMOTION` | `12` | Soft weight reduction applied to an AI proposal whose artist was recently skipped. |
| `AUTOPLAY_V3_SOFT_ARTIST_STREAK` | `4` | Generic V3 fallback only: after this streak, compatible exits gain a gentle preference. |
| `AUTOPLAY_V3_SOFT_ALBUM_STREAK` | `3` | Generic V3 fallback only: after this streak, compatible exits gain a gentle preference. |
| `AI_DJ_WEB_SEARCH` | `false` | Optional paid OpenAI web lookup. Provider resolution still verifies every proposal; enable only when you explicitly want external lookup costs. |
| `AI_DJ_MIN_CONFIDENCE` | `0.55` | AI plans below this confidence leave V3 as the fallback. |
| `AI_DJ_MIN_FIT` | `55` | Individual AI proposals below this transition-fit threshold are discarded before selection. |
| `AUTOPLAY_V3_MAX_ALBUM_CONTINUITY_STREAK` | `3` | Emergency cap for a direct, genre-compatible album run after its soft cap. |
| `AUTOPLAY_V3_MAX_ARTIST_CONTINUITY_STREAK` | `6` | Emergency cap for a direct, genre-compatible artist run after its soft cap. |
| `TRACK_HISTORY_LIMIT` | `80` | Number of tracks retained in the active playback history. |
| `AUTOPLAY_EXPOSURE_TTL_MS` | `1209600000` | How long cross-session autoplay exposure is remembered (14 days). |
| `AUTOPLAY_EXPOSURE_LIMIT` | `300` | Maximum canonical recommendations remembered per guild. |
| `LASTFM_AUTOPLAY_FETCH_LIMIT` | `18` | Similar tracks requested from Last.fm for an adaptive candidate pool. |
| `LASTFM_AUTOPLAY_RESOLVE_LIMIT` | `12` | Similar tracks resolved through Lavalink per autoplay cycle. |
| `AUTOPLAY_DIVERSITY_POOL_SIZE` | `4` | Maximum near-top candidates eligible for weighted variety. |
| `AUTOPLAY_DIVERSITY_SCORE_BAND` | `6` | Maximum score distance from the best candidate for diversity selection. |
| `AUTOPLAY_SELECTION_MAX_SCORE_DROP` | `4` | Strict score gate for exploration; candidates below it need a stronger transition anchor. |
| `AUTOPLAY_SELECTION_QUALITY_ADVANTAGE` | `3` | Transition-quality advantage required for a wider exploration pick. |
| `AUTOPLAY_MIX_FALLBACK_MIN_SCORE` | `58` | Minimum fit score for metadata-free YouTube Mix fallback candidates; Mix never enters the normal safe pool. |
| `AUTOPLAY_MANUAL_CONTEXT_LIMIT` | `12` | Number of recently played user-selected tracks retained as strong autoplay anchors. |
| `AUTOPLAY_MANUAL_MEMORY_LIMIT` | `40` | Durable user-selected memory supplied to the AI DJ as exact tracks plus recurring artists and albums. |
| `AUTOPLAY_PENDING_MANUAL_CONTEXT_LIMIT` | `4` | Upcoming manual queue tracks used to shape recommendations before they play. |
| `AUTOPLAY_DRIFT_GUARD_AFTER` | `1` | Enforces the manual-anchor corridor after the first automatic transition, preventing multi-step drift before it starts. |
| `AUTOPLAY_MANUAL_ANCHOR_MIN_SCORE` | `42` | Minimum normalized fit to a manual anchor while drift protection is active. |
| `AUTOPLAY_UNVERIFIED_DRIFT_PENALTY` | `18` | Penalty for candidates without enough evidence against the manual listening context. |
| `AUTOPLAY_REPEAT_COOLDOWN_MS` | `3600000` | Prevents duplicate recordings during a short session; after one hour a natural repeat can be considered again. |
| `AUTOPLAY_SKIP_GENRE_PENALTY_MAX` | `30` | Caps learned genre penalties; one skipped track contributes one specific-genre penalty instead of one penalty per tag. |
| `AUTOPLAY_ARTIST_WINDOW` | `5` | Recent automatic tracks considered for artist repetition control. |
| `AUTOPLAY_ARTIST_MAX_IN_WINDOW` | `2` | Maximum automatic appearances by one artist in that window before deferral. |
| `AUTOPLAY_TEMPO_CORRIDOR_MAX` | `38` | Maximum verified half/double-time-aware BPM jump before an established session rejects the transition. |
| `AUTOPLAY_ENERGY_CORRIDOR_MAX` | `0.36` | Maximum verified energy jump before an established session rejects the transition. |
| `AUTOPLAY_VALENCE_CORRIDOR_MAX` | `0.48` | Maximum verified valence/mood jump before an established session rejects the transition. |
| `AUTOPLAY_TRANSITION_QUALITY_MIN` | `6` | Minimum transition-quality score preferred when a better safe alternative exists. |
| `AUTOPLAY_TRANSITION_QUALITY_GUARD_AFTER` | `2` | Autoplay streak after which low-quality transitions are deferred. |
| `AUTOPLAY_DEEZER_METADATA_LIMIT` | `18` | Maximum candidates enriched with Deezer metadata during one autoplay cycle. |
| `AUTOPLAY_DEEZER_METADATA_CACHE_TTL_MS` | `604800000` | In-memory cache lifetime for Deezer catalog metadata (7 days). |
| `AUTOPLAY_METADATA_TIMEOUT_MS` | `3500` | Timeout for non-critical metadata requests; playback continues if the lookup fails. |
| `AUTOPLAY_RESOLVE_TIMEOUT_MS` | `12000` | Per-provider timeout while resolving an autoplay or fallback track. |
| `AUTOPLAY_COMMUNITY_METADATA` | `true` | Uses one bounded metadata aggregator for active/manual autoplay anchors. It prefers Last.fm track tags, verifies sparse recordings with MusicBrainz, then uses TheAudioDB only when genre/mood information is still missing. |
| `AUTOPLAY_COMMUNITY_METADATA_CACHE_TTL_MS` | `2592000000` | In-memory lifetime for community metadata (30 days). |
| `AUTOPLAY_COMMUNITY_METADATA_MIN_TAGS` | `2` | Number of usable tags that stops lower-priority community lookups. |
| `AUTOPLAY_MUSICBRAINZ` | `true` | Enables MusicBrainz recording verification; no API key is needed and calls are throttled to one per ~1.1 seconds. |
| `AUTOPLAY_THEAUDIODB` | `true` | Enables TheAudioDB genre/mood fallback. The public key `2` is used unless `THEAUDIODB_API_KEY` is set. |
| `USE_SPOTIFY_AUTOPLAY` | `false` | Opt in to Spotify-derived autoplay candidates. Disabled by default because metadata and availability may vary. |

Autoplay keeps two separate memories. The active playback history is a hard
cooldown for exact recordings and provider variants during the current room
session. A smaller persistent exposure ledger remembers canonical
`artist + title` identities and `seed → recommendation` transitions for a
limited time, so stopping and restarting a room does not immediately recreate
the same radio path. The ledger is stored in `helpers/data/autoplayExposure.json`
and is covered by the existing Compose data volume; it contains no track URLs,
tokens, or full Lavalink payloads.

### Logs

| Variable | Default | Purpose |
| --- | --- | --- |
| `FAST_LOGS` | `1` | Compact console logging. |
| `LOG_TO_FILE` | `1` | Writes bot logs to the local `logs/` directory. |

### Activity gateway

The Activity gateway runs in the bot process and is responsible for authorizing Activity users and sharing player state.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ACTIVITY_ENABLED` | `true` | Enables the Activity gateway. |
| `ACTIVITY_HOST` | `127.0.0.1` | Bind host; use `0.0.0.0` behind a production proxy. |
| `ACTIVITY_PORT` | `8787` | Gateway port. |
| `ACTIVITY_STATE_HEARTBEAT_MS` | `5000` | Background player-state heartbeat in milliseconds; event updates remain immediate. |
| `ACTIVITY_CLIENT_SECRET` | falls back to `DISCORD_CLIENT_SECRET` | Discord application client secret used for the OAuth token exchange. |
| `ACTIVITY_REDIRECT_URI` | `https://127.0.0.1` | Exact OAuth redirect URI registered in the Developer Portal. |
| `ACTIVITY_ALLOWED_ORIGINS` | `*` | Comma-separated allowed browser origins. Restrict this in production. |
| `ACTIVITY_ARTWORK_HOSTS` | empty | Optional comma-separated allowlist for external artwork URLs. |
| `ACTIVITY_ALLOW_DEV` | `false` | Enables local development identity. Never enable on public production. |
| `ACTIVITY_DEV_GUILD_ID` / `ACTIVITY_DEV_USER_ID` | demo values | Local preview identity. |
| `ACTIVITY_DEV_TOKEN` | empty | Optional token protecting local gateway preview. |

## Discord setup

### Bot application

1. Create or open the application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In **Bot**, reset/copy the token into `DISCORD_TOKEN`; never paste it into source code or chat.
3. Copy **Application ID** into `CLIENT_ID` and the Activity build variable `VITE_DISCORD_CLIENT_ID`.
4. Invite the bot with `bot` and `applications.commands` scopes.
5. Give it the permissions it needs in its operating channels: View Channel, Send Messages, Embed Links, Read Message History, Connect, Speak, Use Voice Activity, and Manage Messages/Channels only if you intend to use the matching moderation/setup features.
6. Deploy slash commands with `pnpm deploy:dev` or `pnpm deploy:prod`.

### First server setup

```text
/setup player channel:#music-bot
/setup source server source:youtube
/setup announcements channel:#updates
/setup announcements enable
```

`/setup player channel` is important: it pins the persistent player message to the selected channel instead of falling back to the first available text channel. Users can set a personal default provider with `/setup source me`.

For controlled music rooms, enable DJ mode:

```text
/dj enable role:@DJ
/dj skipmode mode:vote
/dj threshold threshold:50
```

## Discord Activity

The Activity is a separate Vite application in [`activity/`](activity). It communicates with the bot's Activity gateway; it does not need access to the bot token or Lavalink password.

### Local Activity preview

```bash
pnpm --dir activity install
pnpm activity:dev
```

Create `activity/.env.local` from [`activity/.env.example`](activity/.env.example). For a local preview, keep `VITE_ACTIVITY_DEV_MODE=true`. To call a local gateway, set `VITE_ACTIVITY_CONNECT_LOCAL=true`, add the values from `activity/gateway.env.example` to the bot's `.env.dev`, and start the bot plus Lavalink first.

Open `http://127.0.0.1:5173` for the preview.

### Production Activity

1. Build the frontend:

   ```bash
   pnpm activity:build
   ```

2. Serve `activity/dist` at a public HTTPS domain, such as `https://mewbit.example.com`.
3. Reverse proxy `/api/activity` and `/api/token` from that same domain to the bot's `ACTIVITY_PORT` (default `8787`).
4. Set `VITE_ACTIVITY_DEV_MODE=false` and build with the production `VITE_DISCORD_CLIENT_ID` and gateway URL.
5. Set `ACTIVITY_HOST=0.0.0.0`, `ACTIVITY_CLIENT_SECRET`, `ACTIVITY_REDIRECT_URI`, and a restrictive `ACTIVITY_ALLOWED_ORIGINS` on the bot host.
6. In the Developer Portal, enable Activities, configure the Activity URL mapping with your public hostname (for example `mewbit.example.com`), and register the **exact** HTTPS redirect URI used by `ACTIVITY_REDIRECT_URI`.

The configured URL, OAuth redirect URI, Vite application ID, and client secret must all belong to the same Discord application. A `token exchange returned non-JSON data (502)` error usually means the public Activity mapping/proxy is returning HTML instead of forwarding the gateway endpoint.

### Activity capabilities

- Browse home/player views and synchronized room state.
- Search providers, play immediately, or append to the manual section of the queue.
- Seek, pause/resume, previous/next, stop, loop, shuffle, autoplay, mute, and set volume.
- View/edit queue order and remove entries.
- Create, browse, play, and edit playlists.
- Read synced lyrics, including compact lyrics behavior in the minimized view.
- Apply effects or edit the 15-band equalizer.

## Music, queue, and autoplay

### Search behavior

`/play` and Activity search accept normal queries and direct URLs. Direct URLs stay with their provider whenever Lavalink can resolve them. In automatic mode, MewBit prefers the configured default source (YouTube by default) and uses other enabled providers only when necessary.

The autocomplete UI is intentionally a fast suggestion layer. The final `/play` resolver performs a full provider search, so a submitted plain-text query may resolve to a better result than a stale or incomplete suggestion. Result cards and choices display the provider so users can choose deliberately.

Examples:

```text
/play query:Hit Em Up source:youtube
/play query:https://soundcloud.com/artist/track
/play query:https://open.spotify.com/track/...
/play query:artist - song prepend:true
```

### Queue order

The queue has two logical regions:

1. Tracks added by users, in their intended order.
2. Tracks prefetched by autoplay.

`Play now` starts or prepends according to the chosen action. `Add to queue` is appended after manual tracks and before autoplay tracks. This prevents autoplay from jumping ahead of a user's planned music without discarding the prepared transition.

### Autoplay behavior

Autoplay is designed to act like a conservative DJ rather than a random recommender:

- It reads the current track and recent listening window.
- It finds candidates from Last.fm, Deezer, available provider data, and (when explicitly enabled) Spotify.
- It normalizes titles and artists before checking history, so the same song from another provider, a reupload, a remaster tag, or a small punctuation difference is not treated as a new recommendation.
- When resolving a recommendation to playable audio, it verifies that the provider result still matches the canonical artist/title; a provider failure or unrelated result does not silently become the next song.
- It prefers compatible genre/vibe/tempo/energy signals and penalizes abrupt family changes. When Spotify audio features are unavailable, it uses Deezer's public catalog metadata as an additional tempo/loudness anchor and lowers confidence for candidates whose audio profile could not be verified.
- It uses a narrow exploration pool (four candidates within six score points by default) and a transition-quality gate, so variety cannot select a materially weaker song unless it has a clearly better tempo/mood bridge.
- YouTube channel suffixes such as `Vevo`, `Topic`, and `Official Artist Channel` are normalized before artist history and cooldown checks. Noisy Last.fm listener sentences, radio names, playlist fragments, and year tags are excluded from genre anchors.
- If only Deezer BPM/gain and genre cues are available, MewBit creates low-confidence catalog-derived energy/mood hints for tie-breaking. These are not treated as measured audio features; true waveform analysis still requires fetching/decoding the audio and is intentionally not part of the normal autoplay request path.
- It limits artist streaks, but does not ban a fitting artist permanently.
- It keeps manual listening history separate from autoplay history, treats manual tracks as the strongest taste signal, and inspects the next manual queue items before prefetching a recommendation.
- It keeps a separate manual taste fingerprint so autoplay recommendations cannot gradually rewrite the room's genre profile.
- After a configurable autoplay streak, it enforces a manual-anchor corridor and refuses candidates that contradict the queued/user-selected vibe; low-confidence drift candidates cannot enter the emergency same-artist lane.
- When a higher-quality transition exists, low-quality transitions are deferred; automatic artists are also limited within a rolling window while still remaining available as an emergency fallback.
- Provider results are validated again after resolution so an unrelated uploader, mashup, or unexpected edit does not masquerade as the requested recommendation.
- It preserves an already-good autoplay candidate rather than replacing it each time state updates.
- Derived Deezer catalog hints are included in the scorer as low-confidence continuity signals, not just logged metadata. Sparse active/manual anchors are enriched through a single cached community-metadata layer: Last.fm track/album/artist tags first, MusicBrainz verification second, and TheAudioDB only as a final genre/mood backfill. The scorer never treats a lone BPM/gain value as a reliable vibe anchor.
- If no metadata-backed candidate exists, MewBit only retries from a compatible, user-selected anchor with meaningful genre or multi-feature evidence. It never cascades through unverified autoplay fallbacks; a direct YouTube Mix result is the constrained last resort and must pass `AUTOPLAY_MIX_FALLBACK_MIN_SCORE`.

Spotify autoplay is optional (`USE_SPOTIFY_AUTOPLAY=false` by default). Spotify audio-features access is restricted for many Development Mode apps, so MewBit does not depend on it: Spotify metadata is opportunistic, while Last.fm, Deezer catalog metadata, provider-native signals, and the confidence-aware scorer remain usable without a higher Spotify tier.

## Slash commands

Use `/help` in Discord for the live command catalogue. The list below documents the command groups and the behavior currently implemented.

### Playback

| Command | What it does |
| --- | --- |
| `/play query source prepend` | Searches or resolves a URL and adds it to playback. `source` selects the provider; `prepend` places it at the front. |
| `/pause`, `/resume`, `/stop` | Pause, resume, or stop and clear the queue. |
| `/skip`, `/previous` | Move to the next track or return to the prior one. |
| `/seekto position` | Seek the active track. |
| `/volume level` | Change volume. |
| `/loop mode` | Configure loop behavior. |
| `/shuffle` | Shuffle the current queue. |
| `/clearqueue` | Remove all queued tracks. |
| `/remove position` or `/remove title` | Remove a queue item by position or name match. |
| `/247` | Toggle persistent voice-channel behavior. |
| `/autoplay enable` | Turn smart autoplay on or off. |
| `/lyrics synced` | Show lyrics; `synced:true` uses live lyric timing when available. |
| `/like` | Add/remove the playing track from your personal **Liked Songs** playlist. |

Most commands that alter audio require being in the bot's voice channel. DJ restrictions apply when DJ mode is enabled.

### Queue, history, and playlists

| Command | What it does |
| --- | --- |
| `/queue view` | Show the current queue. |
| `/queue export name include-current` | Save the queue as a playlist. |
| `/history view` | Browse listening history. |
| `/history replay number prepend` | Replay a historical item. |
| `/history search query` | Find entries in history. |
| `/history export name limit server-only` | Export history to a playlist. |
| `/history clear server-only` | Clear personal or server history. |
| `/playlist create` | Create a personal or server playlist, optionally public/collaborative. |
| `/playlist list`, `/playlist view`, `/playlist play` | Browse and play playlists. |
| `/playlist add`, `/playlist remove`, `/playlist move`, `/playlist rename`, `/playlist delete` | Maintain playlist contents and names. |
| `/playlist edit`, `/playlist collaborators`, `/playlist share`, `/playlist merge` | Change visibility/description/collaboration and share or combine playlists. |
| `/playlist import` | Import from a share code or supported Spotify/YouTube playlist URL. |

### Sound shaping

| Command | What it does |
| --- | --- |
| `/eq list` | List built-in EQ presets. |
| `/eq preset name`, `/eq reset` | Apply a preset or reset EQ to flat. |
| `/eq mypresets`, `/eq delete` | Manage saved personal presets. |
| `/eqpanel` | Open the interactive custom equalizer panel and save a custom preset. |
| `/filter list` | List audio-effect presets. |
| `/filter preset name`, `/filter reset` | Apply/remove Lavalink effects while preserving the current EQ. |

Built-in effects include nightcore, vaporwave, chipmunk, deepvoice, karaoke, wobble, vibrato, robot, telephone, mono, surround, and meme. Available options are shown through command autocomplete.

### DJ controls

| Command | What it does |
| --- | --- |
| `/dj enable role` / `/dj disable` | Enable or disable DJ control for a server. |
| `/dj setrole role` | Select the role allowed to control music. |
| `/dj skipmode mode` / `/dj threshold threshold` | Configure skip behavior and vote threshold. |
| `/dj permissions strict` | Configure DJ permission strictness. |
| `/dj status` | Show the active DJ configuration. |

### Server setup and insight

| Command | What it does |
| --- | --- |
| `/setup player channel`, `clear`, `status` | Configure the persistent player-message channel. |
| `/setup source server` | Set the server's default search provider. |
| `/setup source me` | Set or override your personal default provider. |
| `/setup source status` | Display active search-source settings. |
| `/setup announcements channel`, `enable`, `disable`, `status`, `reset` | Configure update announcements. |
| `/stats detailed` | Show MewBit listening and usage stats. |
| `/wrapped me [user]` / `/wrapped server` | Show personal or server listening wrap-up. |
| `/changelog [version]` | View release notes. |
| `/health status`, `metrics`, `errors`, `reset` | Inspect Lavalink/bot health and recent errors. |
| `/logs setup`, `enable`, `disable`, `access`, `status`, `delete` | Configure server event logging. |

### Community utilities

| Command | What it does |
| --- | --- |
| `/ticket create`, `list`, `view` | Open and track support tickets. |
| `/ticket admin setup`, `disable`, `pending`, `respond`, `close` | Admin ticket management. |
| `/mod kick`, `ban`, `unban`, `timeout`, `untimeout`, `purge`, `slowmode`, `lock`, `unlock`, `warn` | Moderation actions; Discord permissions are required. |
| `/embed` | Create a custom embed in a chosen channel. |
| `/user user` | Display basic Discord account and member information. |

## Deployment

### Production with Docker Compose

1. Create production configuration:

   ```powershell
   Copy-Item .env-example .env
   ```

2. Edit `.env` and set real credentials. Important: with the provided Compose stack use:

   ```env
   LAVALINK_HOST=lavalink
   ACTIVITY_HOST=0.0.0.0
   ACTIVITY_PORT=8787
   ```

3. Build the pinned YouTube-source patch before the first start or after clearing `helpers/lavalink/plugins/`:

   ```bash
   pnpm lavalink:youtube:patch
   ```

   It compiles youtube-source 1.18.2 with the targeted PS4 TV user-agent fix and writes the JAR to `helpers/lavalink/plugins/`. Docker and Git must be available. The Compose stack also starts a private `yt-cipher` service, which handles current YouTube signature scripts.
4. Start the stack:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

5. Follow logs during the first startup:

   ```bash
   docker compose logs -f lavalink
   docker compose logs -f bot
   ```

The Compose stack persists bot data in `helpers/data` and file logs in `logs`. Back up these folders before rebuilding a host.

### Raspberry Pi / ARM image

The repository includes an ARM64 image-build script:

```bash
pnpm docker:build
```

It publishes the configured `linux/arm64` image name from `package.json`. Use the normal Compose instructions on the Pi once the image is available.

### Updating safely

```bash
git pull
pnpm install
pnpm --dir activity install
pnpm test
pnpm lint
pnpm activity:build
docker compose up -d --build
```

Run `pnpm deploy:prod` only when Discord slash-command definitions changed. For Activity-only frontend changes, rebuild the Activity and reload the static host/reverse proxy as appropriate.

## Testing and diagnostics

### Standard checks

```bash
pnpm test
pnpm lint
pnpm activity:build
```

The test suite covers autoplay candidate normalization/scoring, provider fallbacks, duplicate prevention, queue behavior, Activity gateway behavior, and other helpers. Browser/UI behavior should additionally be tested in Discord because the embedded Activity lifecycle and permissions cannot be fully simulated by unit tests.

### Autoplay soak and replay tests

You can exercise hundreds of autoplay decisions locally without joining a voice channel or playing audio:

```bash
pnpm test:autoplay:soak
pnpm test:autoplay:soak -- --steps 500 --seed 42
pnpm test:autoplay:soak -- --fixture tests/fixtures/autoplay/replay.example.json
pnpm test:autoplay:soak -- --fixture tests/fixtures/autoplay/replay.example.json --json
```

The simulator reuses the production session profile, candidate scorer, duplicate identity checks, manual-vibe corridor, transition-quality gate, artist rolling window, and deterministic exploration order. It reports unresolved cycles, provider-resolution failures, cross-provider duplicates, genre-family jumps, artist streaks, fallback usage, and source distribution. A non-zero exit code means the configured acceptance limits were exceeded.

For a test that is much closer to the real bot, use the live soak runner after starting local Lavalink:

```bash
pnpm lavalink:dev
pnpm test:autoplay:live -- --query "Tame Impala - Let It Happen" --steps 10
pnpm test:autoplay:live -- --query "Kuki - Ciepłe Dranie" --steps 5 --delay-ms 1000 --json
pnpm test:autoplay:live -- --query "Ariana Grande - Into You" --manual-query "The Weeknd - Save Your Tears" --steps 10
```

The live runner uses the actual Last.fm/Deezer/Spotify candidate collection, real Lavalink search and provider resolution, production scoring, fallback handling, exposure memory, duplicate history, and optional upcoming manual tracks. It now reports evidence quality, fallback selections, genre-bridge strength, and verified tempo/energy/valence transition distances. It does not log in to Discord, join a voice channel, add tracks to a real queue, or play audio. It loads `.env` when present and otherwise `.env.dev`; `AUTOPLAY_LIVE_ENV_FILE` can select another file. It requires local Lavalink and the provider credentials from that env file.

Replay fixtures are JSON files with a `seedTrack` and either `replaySteps` or `candidatesByReference`. The latter maps a reference track identifier to the candidate list that was observed in a real run, making it possible to replay a captured queue locally. Provider/network resolution is represented with `playable: false`; the simulator then tests whether another candidate keeps the session alive.

### Useful runtime checks

```text
/health status
/health metrics
/health errors limit:10
/setup player status
/setup source status
/dj status
```

For containers:

```bash
docker compose ps
docker compose logs --tail=200 bot
docker compose logs --tail=200 lavalink
```

### Common issues

| Symptom | Check |
| --- | --- |
| Bot is online but cannot play music | Verify Lavalink is healthy, `LAVALINK_HOST/PORT/PASSWORD` match, and bot logs show a node connection. |
| Player message appears in the wrong channel | Run `/setup player channel:#desired-channel`; the bot needs View/Send/Embed permission there. |
| A provider does not find or play restricted tracks | Verify provider credentials/cookies, Lavalink plugins, and the relevant Lavalink log lines. |
| A Spotify link skips or previously played the wrong song | Check the YouTube credentials and Lavalink logs. Spotify is metadata-only; MewBit now uses an ISRC-first YouTube mirror and rejects unverified alternate versions instead of accepting a loose fallback. |
| Autoplay stops after an unusual track | Check `/health errors`; low-information tracks can exhaust metadata candidates. YouTube Mix is only a constrained fallback, so it may still decline an unsafe/unrelated recommendation. |
| Activity is blank or shows only a preview | Verify the public HTTPS URL mapping, `VITE_DISCORD_CLIENT_ID`, Activity client secret, exact redirect URI, and reverse proxy routes for `/api/activity` and `/api/token`. |
| Activity authorization returns HTML/502 | The production domain/proxy is likely serving the frontend document for a gateway endpoint. Confirm API routes reach `ACTIVITY_PORT`. |
| Controls work locally but not for another user | Open through Discord's real Activity entry point, not the local preview; ensure the Activity gateway is reachable on the configured public origin. |

## Project layout

```text
activity/                 Discord Activity frontend (Vite)
assets/                   Branding, artwork, and static assets
commands/music/           Music slash commands
commands/utility/         Setup, moderation, health, tickets, and utility commands
events/                   Discord event handlers
helpers/activity/         Activity gateway and shared-state API
helpers/lavalink/         Lavalink integration, autoplay, provider logic, filters
helpers/playlists/        Playlist storage and operations
helpers/data/             Persisted local bot data (runtime)
helpers/lavalink/plugins/ Optional Lavalink plugins used by the local node
tests/                    Node test suite
docker-compose.yml        Production bot + Lavalink stack
```

Additional internal design notes live in [`DESIGN.md`](DESIGN.md) and [`PRODUCT.md`](PRODUCT.md). The dedicated Activity setup reference is [`activity/README.md`](activity/README.md).

## Security and provider responsibility

MewBit integrates with third-party services whose access rules, content availability, and APIs can change independently. You are responsible for configuring provider credentials lawfully, respecting each service's terms, and protecting every token/cookie/secret used by your deployment.

Before publishing or sharing a repository clone, check that `.env`, `.env.*`, cookie files, logs, and runtime data are excluded. If a secret was ever pasted into chat, a commit, or a public location, revoke and rotate it immediately.
