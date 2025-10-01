# Neo Beat Buddy

A Discord music bot powered by Lavalink and Poru.

## Features
- Slash-only interface for queueing, playback, and moderation safeguards.
- Real-time playback statistics per guild and globally via `/stats`.
- Lyrics lookup for the current track with `/lyrics`.
- Interactive queue pagination, playback control buttons, and modal volume input.
- Live equalizer presets plus per-band tweaking with `/eq`.
- Docker-based production stack (Discord bot + Lavalink) together with a pnpm-first dev workflow.

## Requirements
- Node.js 20+ and pnpm 10+.
- Docker & Docker Compose (for hosting Lavalink or the full stack).
- Lavalink 4.x credentials (see `.env-example`).

## Quick Start

```bash
pnpm install
cp .env-example .env.dev # fill in Discord token and Lavalink creds  
pnpm lavalink:dev # start Lavalink via helpers/lavalink/docker-compose.yml  
pnpm start:dev # run the dev bot using .env.dev  
```

Deploy slash commands to your test guild:  
```bash
pnpm deploy:dev
```

## Slash Commands

### Playback
- `/play query:<song or url> [prepend:true]` — queue a track from YouTube, Spotify, or a search query.
- `/pause`, `/resume`, `/stop` — pause, resume, or stop playback (stop also clears the queue).
- `/skip [position:<number> | title:<keyword>]` — skip now playing or remove a queued item.
- `/previous` — restart the current track or jump to the previous one.
- `/seekto position:<seconds|mm:ss|hh:mm:ss>` — jump to a specific timestamp.
- `/volume level:<0-100>` — set the playback volume.
- `/lyrics` — show lyrics for the current track.

### Queue & Looping
- `/queue` — view the queue with pagination buttons.
- `/clearqueue` — wipe the queue entirely.
- `/shuffle` — randomise the queue order.
- `/loop [mode:<NONE|TRACK|QUEUE>]` — toggle loop modes.

### Equalizer & Effects
- `/eq preset name:<preset>` — apply presets such as bass, nightcore, lofi, etc.
- `/eq set band:<0-14> gain:<value>` — nudge a single EQ band.
- `/eq reset` — reset the EQ to flat.

### Utility
- `/stats` — display per-guild and global playback stats.
- `/user user:<member>` — inspect a member’s profile, flags, and status.
- `/help` — open the interactive help menu.

## Production on Raspberry Pi

Copy the repo and prepare `.env.prod` (set `LAVALINK_HOST=lavalink`), then run:
```bash
docker compose up -d --build
```

To update later:  
```bash
git pull  
docker compose up -d --build
```

## Docker Image for Pi (optional)

```bash
docker login  
docker buildx build --platform linux/arm64 -t <user>/neo-bot:latest --push .
```

Or save/load a tarball when Docker Hub is available.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm start:dev` | Run bot using `.env.dev` |
| `pnpm start:prod` | Run bot using `.env.prod` |
| `pnpm lavalink:dev` | Start local Lavalink (`helpers/lavalink/docker-compose.yml`) |
| `pnpm lavalink:dev:down` | Stop the local Lavalink container |
| `pnpm docker:prod` | Build & run the production Docker stack |
| `pnpm deploy`, `:dev`, `:prod` | Publish slash commands (global/dev/prod) |
| `pnpm lint` / `pnpm lint:fix` | Run ESLint checks or auto-fix issues |

## Environment Files
- `.env.dev` — development token & Lavalink host (`127.0.0.1`).
- `.env.prod` — production token & Lavalink host (`lavalink` for Docker).
- `.env` — active environment file (git-ignored).

