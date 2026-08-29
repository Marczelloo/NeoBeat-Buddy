<!-- Split out of README.md. -->

[← Back to the README](../README.md)

# Discord setup

## Bot application

1. Create or open the application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. In **Bot**, reset/copy the token into `DISCORD_TOKEN`; never paste it into source code or chat.
3. Copy **Application ID** into `CLIENT_ID` and the Activity build variable `VITE_DISCORD_CLIENT_ID`.
4. Invite the bot with `bot` and `applications.commands` scopes.
5. Give it the permissions it needs in its operating channels: View Channel, Send Messages, Embed Links, Read Message History, Connect, Speak, Use Voice Activity, and Manage Messages/Channels only if you intend to use the matching moderation/setup features.
6. Deploy slash commands with `pnpm deploy:dev` or `pnpm deploy:prod`.

## First server setup

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

# Discord Activity

The Activity is a separate Vite application in [`activity/`](activity). It communicates with the bot's Activity gateway; it does not need access to the bot token or Lavalink password.

## Local Activity preview

```bash
pnpm --dir activity install
pnpm activity:dev
```

Create `activity/.env.local` from [`activity/.env.example`](activity/.env.example). For a local preview, keep `VITE_ACTIVITY_DEV_MODE=true`. To call a local gateway, set `VITE_ACTIVITY_CONNECT_LOCAL=true`, add the values from `activity/gateway.env.example` to the bot's `.env.dev`, and start the bot plus Lavalink first.

Open `http://127.0.0.1:5173` for the preview.

## Production Activity

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

## Activity capabilities

- Browse home/player views and synchronized room state.
- Search providers, play immediately, or append to the manual section of the queue.
- Seek, pause/resume, previous/next, stop, loop, shuffle, autoplay, mute, and set volume.
- View/edit queue order and remove entries.
- Create, browse, play, and edit playlists.
- Read synced lyrics, including compact lyrics behavior in the minimized view.
- Apply effects or edit the 15-band equalizer.
