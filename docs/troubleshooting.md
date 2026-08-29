<!-- Split out of README.md. -->

[← Back to the README](../README.md)

# Testing and diagnostics

## Standard checks

```bash
pnpm test
pnpm lint
pnpm activity:build
```

The test suite covers autoplay candidate normalization/scoring, provider fallbacks, duplicate prevention, queue behavior, Activity gateway behavior, and other helpers. Browser/UI behavior should additionally be tested in Discord because the embedded Activity lifecycle and permissions cannot be fully simulated by unit tests.

## Autoplay soak and replay tests

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

## Useful runtime checks

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

## Common issues

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
