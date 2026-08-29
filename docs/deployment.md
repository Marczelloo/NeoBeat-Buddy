<!-- Split out of README.md. -->

[← Back to the README](../README.md)

# Deployment

## Production with Docker Compose

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

## Raspberry Pi / ARM image

The repository includes an ARM64 image-build script:

```bash
pnpm docker:build
```

It publishes the configured `linux/arm64` image name from `package.json`. Use the normal Compose instructions on the Pi once the image is available.

## Updating safely

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
