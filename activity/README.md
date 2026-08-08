# MewBit Activity

This folder contains the real Discord Activity. It is separate from the existing player embed, but it uses the same bot and Lavalink player through the Activity gateway in `helpers/activity/server.js`.

## Local preview

1. Copy `activity/.env.example` to `activity/.env.local`.
2. Copy the values from `activity/gateway.env.example` into the bot's `.env.dev` and keep `ACTIVITY_ALLOW_DEV=true` for local preview only.
3. Start the bot and Lavalink with the existing development commands.
4. Start the Activity with `pnpm --dir activity dev`.
5. Open `http://127.0.0.1:5173` to inspect the UI. With `VITE_ACTIVITY_DEV_MODE=true`, the page has a local preview state. With `VITE_ACTIVITY_CONNECT_LOCAL=true`, it can call the local gateway using the dev identity.

## Production shape

- Build this app with `pnpm --dir activity build` and host `activity/dist` over HTTPS.
- Run the bot gateway on a reachable HTTPS origin or reverse proxy `/api/activity` and `/api/token` to the bot's `ACTIVITY_PORT`.
- Set `VITE_ACTIVITY_DEV_MODE=false`, `ACTIVITY_ALLOW_DEV=false`, and `VITE_DISCORD_CLIENT_ID` to the same application ID as the bot.
- Keep `DISCORD_CLIENT_SECRET` only in the bot environment. The gateway uses it for the server-side authorization-code exchange.
- Configure the same application in the Discord Developer Portal with Activities enabled, the hosted Activity URL, an Entry Point command, and an OAuth2 redirect URI. Discord's Embedded App SDK handles the in-Activity authorization redirect.

## Included controls

The Activity already exposes current track state, progress and seek, volume and mute, pause and resume, previous, skip, loop, shuffle, autoplay, queue reorder and removal, source-aware search, fun filters, 15-band EQ, synced or static lyrics, and playlist creation, playback, and saving the current track.
