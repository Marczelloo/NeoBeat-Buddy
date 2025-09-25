# Neo Beat Buddy

A Discord music bot powered by Lavalink and Poru.

## Features
- Slash-only interface for playback, queueing, and equalizer presets.
- Interactive queue pagination and on-message playback controls.
- Live equalizer presets plus per-band tweaking with `/eq`.
- Docker-based production stack (Discord bot + Lavalink) together with pnpm dev workflow.

## Requirements
- Node.js 20+ and pnpm 10+.
- Docker & Docker Compose (for hosting Lavalink or the full stack).
- Lavalink 4.x credentials (see `.env-example`).

## Quick Start

```bash
pnpm install
cp .env-example .env.dev   # fill in Discord token and Lavalink creds
pnpm lavalink:dev          # start Lavalink via helpers/lavalink/docker-compose.yml
pnpm start:dev             # run the dev bot using .env.dev
```

Deploy slash commands to your test guild:

```bash
pnpm deploy:dev
```

## Production on Raspberry Pi

```bash
# copy repo + .env.prod (with LAVALINK_HOST=lavalink)
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

| Script                  | Description                                         |
|-------------------------|-----------------------------------------------------|
| `pnpm start:dev`        | Run bot using `.env.dev`                            |
| `pnpm start:prod`       | Run bot using `.env.prod`                           |
| `pnpm lavalink:dev`     | Start local Lavalink (`helpers/lavalink/docker-compose.yml`) |
| `pnpm lavalink:dev:down`| Stop the local Lavalink container                   |
| `pnpm docker:prod`      | Build & run the production Docker stack             |
| `pnpm deploy`, `:dev`, `:prod` | Publish slash commands (global/dev/prod)  |
| `pnpm lint` / `pnpm lint:fix` | ESLint checks and auto-fix                 |

## Help Command

Use `/help` to browse command categories via a select menu and view usage examples for every command.

## Environment Files

- `.env.dev` — development token & Lavalink host (`127.0.0.1`).
- `.env.prod` — production token & Lavalink host (`lavalink` for Docker).
- `.env` — active environment file (git-ignored).
