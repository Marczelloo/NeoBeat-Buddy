# ⚠️ IMPORTANT LEGAL NOTICE

## THIS IS AN EDUCATIONAL PROJECT ONLY

This bot is provided as a **proof-of-concept** and **educational example**.

### 🚨 DO NOT USE IN PRODUCTION

**Deploying this bot publicly may violate:**

- YouTube Terms of Service
- Spotify Terms of Service
- Copyright laws
- DMCA regulations

### ⚖️ Legal Risks

By deploying this bot, you may face:

- API access revocation
- Account suspension
- Legal action from content owners
- DMCA takedown notices
- Potential lawsuits

### 📚 Intended Use

This code is meant for:

- ✅ Learning how Discord bots work
- ✅ Understanding Lavalink integration
- ✅ Studying audio streaming architecture
- ✅ Private testing (1-2 users max)

### 🛑 NOT Intended For

- ❌ Public Discord servers
- ❌ Production environments
- ❌ Any commercial use
- ❌ Servers with >10 members
- ❌ Monetized communities

### 🔒 Your Responsibility

If you choose to deploy this bot:

- YOU are responsible for all legal consequences
- YOU must ensure compliance with all Terms of Service
- YOU accept all risks of account suspension or legal action
- The author provides NO support for legal issues

**Use at your own risk. The author is not liable for your deployment choices.**

# Neo Beat Buddy

A feature-rich Discord music bot powered by Lavalink and Poru, with DJ mode, smart autoplay, advanced statistics, persistent EQ settings, and seamless playlist support.

## Features

- **Slash-only interface** for queueing, playback, and moderation safeguards.
- **Smart autoplay** with Spotify recommendations and YouTube Mix — learns from listening patterns, avoids artist clustering, and filters non-music content.
- **DJ mode** with role-based permissions, skip voting (dj/vote/hybrid modes), and track suggestion approval workflow.
- **Real-time statistics** per guild and globally via `/stats` — tracks songs played, listening hours, unique users, peak listeners, top sources, and hourly activity patterns.
- **Lyrics lookup** for the current track with `/lyrics` (powered by Genius API).
- **Interactive queue management** with pagination, track removal by position or keyword, and shuffle.
- **Live equalizer** with presets (bass, nightcore, lofi, etc.) and per-band fine-tuning — settings persist across bot restarts.
- **Persistent state** — now playing messages, EQ configurations, DJ settings, guild stats, and autoplay preferences survive restarts.
- **Age-restricted content handling** with automatic fallback to alternate sources.
- **Track history** with `/previous` command to replay or rewind.
- **Docker-based production stack** with health checks and auto-restart policies.
- **pnpm-first workflow** for fast, efficient dependency management.

## Requirements

- **Node.js** 20+ and **pnpm** 10+
- **Docker** & **Docker Compose** (for hosting Lavalink or the full stack)
- **Lavalink** 4.x credentials (see `.env-example`)
- **Genius API key** (optional, for lyrics)
- **Spotify credentials** (recommended for autoplay, enables Spotify playback)

## Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Copy environment template and configure
cp .env-example .env.dev
# Edit .env.dev with your Discord token, Lavalink host (127.0.0.1), and API keys

# Start Lavalink locally
pnpm lavalink:dev

# Run the bot in development mode
pnpm start:dev
```

Deploy slash commands to your test guild:

```bash
pnpm deploy:dev
```

---

## Slash Commands

### 🎵 Playback Control

- **`/play query:<song or url> [prepend:true]`**  
  Queue a track from YouTube, Spotify, or a search query. Use `prepend:true` to add it to the front of the queue.  
  _In DJ mode, non-DJs submit suggestions for approval._

- **`/pause`** — Pause the currently playing track (DJ restricted in DJ mode).
- **`/resume`** — Resume a paused track (DJ restricted in DJ mode).
- **`/stop`** — Stop playback and clear the queue (DJ only while DJ mode is enabled).
- **`/skip`** — Skip the current track or trigger vote-based skip depending on DJ mode configuration.
- **`/previous`** — Restart the current track or jump to the previous one from history (DJ restricted in DJ mode).
- **`/seekto position:<seconds|mm:ss|hh:mm:ss>`** — Jump to a specific timestamp in the current track (DJ restricted in DJ mode).
- **`/volume level:<0-100>`** — Set the playback volume (DJ only in DJ mode).
- **`/lyrics`** — Display lyrics for the currently playing song.
- **`/autoplay`** — Toggle smart autoplay mode that automatically queues similar tracks when the queue ends (DJ only).

---

### 📜 Queue & Looping

- **`/queue`** — View the current queue with pagination controls. Pending DJ suggestions appear when DJ mode is active.
- **`/remove [position:<number>] [title:<keyword>]`** — Remove a specific track from the queue by position or title search (DJ only in DJ mode).
- **`/clearqueue`** — Remove every track from the queue (DJ only while DJ mode is enabled).
- **`/shuffle`** — Randomize the queue order (DJ restricted in DJ mode).
- **`/loop [mode:<NONE|TRACK|QUEUE>]`** — Toggle loop modes (DJ restricted in DJ mode).

---

### 🤖 Smart Autoplay

**Autoplay automatically discovers and queues music when your queue is empty.**

#### How It Works

1. **Analyzes your listening history** — Tracks the last 15 songs played to understand your music taste.
2. **Multi-source recommendations** — Pulls suggestions from:
   - **Spotify** — Genre-aware recommendations using Spotify's algorithm
   - **YouTube Mix** — Related tracks from YouTube's radio feature
   - **Top artist search** — Songs from your most-played artists
3. **Smart scoring system** — Ranks candidates using 6 factors:
   - Artist familiarity (how often you've played them)
   - Duration similarity (matches average song length)
   - Source quality (Spotify > YouTube Mix > Search)
   - Diversity bonus (avoids artist clustering)
   - Skip learning (downweights artists you skip frequently)
   - Duplicate prevention (never plays the same song twice)
4. **Quality filtering** — Automatically rejects:
   - Non-music content (tutorials, poetry, spoken word)
   - Short clips (<30 seconds)
   - Videos with excessive hashtags or emojis
   - Known non-music channels

#### Usage

```bash
# Enable autoplay (DJ permission required)
/autoplay

# Autoplay status shows in the now-playing message
```

**When enabled**, autoplay triggers automatically when the queue ends, seamlessly continuing your listening session with curated recommendations.

---

### 🎛️ DJ Mode

- **`/dj enable [role:<role>] [skipmode:<mode>] [threshold:<10-100>]`**  
  Enable DJ mode. Optionally specify a DJ role (or let the bot create one), skip mode (`dj`, `vote`, or `hybrid`), and vote threshold percentage.

- **`/dj disable`** — Disable DJ mode.
- **`/dj setrole role:<role>`** — Change the DJ role.
- **`/dj skipmode mode:<dj|vote|hybrid> [threshold:<10-100>]`**  
  Configure skip behavior:

  - `dj`: Only DJ can skip
  - `vote`: Vote-based skip with threshold
  - `hybrid`: Vote unless DJ overrides

- **`/dj permissions strict:<true|false>`**  
  Toggle strict permissions:

  - `true`: Only DJ role can manage DJ settings
  - `false`: Server managers can also configure DJ mode

- **`/dj status`** — Show current DJ configuration (role, skip mode, vote threshold, strict mode).

---

### 🎚️ Equalizer & Effects

#### Interactive Mixer Panel

- **`/eqpanel`**  
  Open an interactive 15-band equalizer mixer panel with real-time visual feedback and controls.

  **Features:**

  - **Per-band selection**: Use ▲/▼ buttons to navigate bands 0-14 (25Hz to 16kHz)
  - **Fine-tune gain**: Adjust selected band with + / ++ / -- / - buttons
    - Single press: ±1.0dB increments
    - Shift press (hold Shift while clicking): ±0.5dB precision
  - **Visual bars**: Horizontal bars show gain levels (-12dB to +6dB), selected band marked with ►
  - **A/B comparison**: Save snapshot with 💾, toggle with 🔄 to compare settings
  - **Save custom presets**: Use 📁 button to save current EQ as a reusable preset
  - **Throttled updates**: Changes batched at 200ms to prevent Lavalink spam
  - **Fine-tune modal**: Advanced users can directly input all 15 gain values

#### Preset Management

- **`/eq preset name:<preset>`**  
  Apply a built-in or custom equalizer preset. Uses autocomplete to show all available presets:

  - **Built-in presets** (22 total): Spotify-quality presets marked as `(built-in)`
  - **Custom presets**: Your saved presets marked as `(custom)`

- **`/eq list`**  
  Display all 22 built-in equalizer presets organized by category:

  - **General**: flat, acoustic, classical, piano, vocal, podcast, smallspeakers
  - **Genre-Based**: pop, rock, jazz, dance, electronic, edm, hiphop, rnb, latin
  - **Bass & Treble**: bass, bassboost, deep, treble
  - **Special**: lofi, nightcore

- **`/eq mypresets`**  
  View all your saved custom presets with usage examples and timestamps.

- **`/eq delete name:<preset>`**  
  Delete one of your custom presets. Uses autocomplete to filter your presets only.

- **`/eq reset`**  
  Reset the equalizer to a flat response (all bands at 0dB).

#### Custom Preset System

Save up to **10 custom EQ configurations** per user:

1. **Create in mixer panel**: Open `/eqpanel`, adjust bands, click 📁 Save Preset
2. **Name your preset**: Alphanumeric names only (3-20 chars, no spaces), e.g., `mybass`, `gaming1`
3. **Load anytime**: Use `/eq preset name:mybass` to apply your saved configuration
4. **Manage presets**: View with `/eq mypresets`, delete with `/eq delete`
5. **Persistence**: Custom presets survive bot restarts (stored in `helpers/data/customPresets.json`)

#### EQ Technical Details

- **15 bands**: 25Hz, 40Hz, 63Hz, 100Hz, 160Hz, 250Hz, 400Hz, 630Hz, 1kHz, 1.6kHz, 2.5kHz, 4kHz, 6.3kHz, 10kHz, 16kHz
- **Gain range**: -12dB to +6dB per band (Lavalink values: -0.25 to +1.0)
- **Visual representation**: Horizontal bars with center marker at 0dB
- **Real-time updates**: Changes apply immediately with visual feedback
- **State persistence**: EQ settings restore automatically when player reconnects

_EQ settings persist across bot restarts and are restored automatically when the player reconnects._

---

### 🛠️ Utility

- **`/stats [detailed:true]`**  
  Display per-guild and global playback statistics:

  - Songs played, listening hours
  - Songs skipped, playlists added
  - Unique users, peak listeners
  - Session count, average session length
  - _Detailed mode:_ Top sources, most active hour

- **`/user user:<member>`** — Inspect a member's profile, badges, flags, and status.
- **`/help`** — Open the interactive help menu with categorized commands.

---

## Production Deployment (Raspberry Pi / Server)

### Docker Stack (Recommended)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Marczelloo/NeoBeat-Buddy.git
   cd NeoBeat-Buddy
   ```

2. **Create `.env.prod` file:**

   ```bash
   cp .env-example .env.prod
   ```

   Edit `.env.prod` with your production credentials:

   ```env
   DISCORD_TOKEN=your-production-token
   CLIENT_ID=your-client-id
   LAVALINK_HOST=lavalink  # Important for Docker!
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=your-secure-password
   GENIUS_API_KEY=your-genius-api-key
   SPOTIFY_CLIENT_ID=your-spotify-id
   SPOTIFY_CLIENT_SECRET=your-spotify-secret
   ```

3. **Deploy slash commands:**

   ```bash
   pnpm deploy:prod
   ```

4. **Start the Docker stack:**

   ```bash
   docker compose up -d --build
   ```

5. **Check logs:**
   ```bash
   docker compose logs -f bot
   docker compose logs -f lavalink
   ```

### Update Deployment

```bash
git pull
docker compose down
docker compose pull
docker compose up -d --build
```

---

## Docker Image for ARM64 (Raspberry Pi)

Build and push a multi-platform image:

```bash
docker login
docker buildx build --platform linux/arm64 -t <your-dockerhub-user>/neo-beat-buddy:latest --push .
```

Or build and save as a tarball:

```bash
docker buildx build --platform linux/arm64 -o type=docker,dest=neo-bot.tar .
docker load -i neo-bot.tar
```

---

## Scripts

| Script                         | Description                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `pnpm start:dev`               | Run bot using `.env.dev`                                     |
| `pnpm start:prod`              | Run bot using `.env.prod`                                    |
| `pnpm lavalink:dev`            | Start local Lavalink (`helpers/lavalink/docker-compose.yml`) |
| `pnpm lavalink:dev:down`       | Stop the local Lavalink container                            |
| `pnpm docker:prod`             | Build & run the production Docker stack                      |
| `pnpm docker:build`            | Build and push ARM64 Docker image                            |
| `pnpm deploy`, `:dev`, `:prod` | Deploy slash commands (global/dev/prod)                      |
| `pnpm lint`                    | Run ESLint checks                                            |
| `pnpm lint:fix`                | Auto-fix ESLint issues                                       |
| `pnpm test`                    | Run all tests                                                |
| `pnpm test:autoplay`           | Run autoplay tests only                                      |

---

## Environment Variables

### Required

| Variable            | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `DISCORD_TOKEN`     | Your Discord bot token                                       |
| `CLIENT_ID`         | Your Discord application client ID                           |
| `LAVALINK_HOST`     | Lavalink host (`127.0.0.1` for local, `lavalink` for Docker) |
| `LAVALINK_PORT`     | Lavalink port (default: `2333`)                              |
| `LAVALINK_PASSWORD` | Lavalink password                                            |

### Optional

| Variable                      | Default  | Description                                  |
| ----------------------------- | -------- | -------------------------------------------- |
| `GENIUS_API_KEY`              | -        | Genius API key for lyrics lookup             |
| `SPOTIFY_CLIENT_ID`           | -        | Spotify client ID (for autoplay and Spotify) |
| `SPOTIFY_CLIENT_SECRET`       | -        | Spotify client secret                        |
| `YOUTUBE_PO_TOKEN`            | -        | YouTube PO token for age-restricted content  |
| `YOUTUBE_VISITOR_DATA`        | -        | YouTube visitor data                         |
| `YOUTUBE_REFRESH_TOKEN`       | -        | YouTube refresh token                        |
| `DEFAULT_VOLUME`              | `50`     | Default playback volume (0-100)              |
| `INACTIVITY_TIMEOUT_MS`       | `300000` | Inactivity timeout in ms (5 minutes)         |
| `PROGRESS_UPDATE_INTERVAL_MS` | `10000`  | Player progress update interval (10 seconds) |
| `TRACK_HISTORY_LIMIT`         | `20`     | Max tracks to keep in history                |
| `FAST_LOGS`                   | `1`      | Enable fast logging (0 to disable)           |
| `LOG_TO_FILE`                 | `1`      | Enable file logging (0 to disable)           |

---

## File Structure

```
NeoBeat-Buddy/
├── commands/
│   ├── music/          # Playback, queue, autoplay, and DJ commands
│   └── utility/        # Stats, help, user commands
├── events/             # Discord.js event handlers
├── helpers/
│   ├── data/           # Persistent JSON stores (git-ignored)
│   │   ├── .gitkeep
│   │   ├── dj.json
│   │   ├── stats.json
│   │   ├── guildState.json
│   │   └── equalizer.json
│   ├── dj/             # DJ mode logic
│   ├── equalizer/      # EQ presets and messages
│   ├── help/           # Help command categories
│   ├── interactions/   # Guards (DJ, voice channel)
│   ├── lavalink/       # Lavalink client, filters, playback, autoplay
│   ├── logs/           # Logging utilities
│   └── stats/          # Statistics tracking
├── tests/              # Unit and integration tests
│   └── helpers/
│       └── lavalink/
│           └── smartAutoplay.test.js
├── logs/               # Log files (git-ignored)
├── .github/
│   └── workflows/
│       └── ci.yml      # GitHub Actions CI pipeline
├── docker-compose.yml  # Production stack (bot + Lavalink)
├── dockerfile          # Bot container definition
├── .env-example        # Environment template
├── package.json
└── pnpm-lock.yaml
```

---

## Smart Autoplay Technical Details

### Architecture

- **Session profiling** — Analyzes last 15 tracks for artist frequency and average duration
- **Multi-source candidates** — Gathers recommendations from Spotify, YouTube Mix, and top artist searches
- **6-factor scoring algorithm**:
  1. Artist familiarity (+5 per occurrence)
  2. Duration similarity (+10 within 20%, +5 within 40%)
  3. Source preference (Spotify +25, YouTube Mix +15, Search +10)
  4. Diversity bonus (+20 for artists not in top 3)
  5. Skip learning (-20 per recent skip)
  6. Duplicate prevention (-1000 for played tracks)
- **Skip tracking** — Remembers last 50 skips (30-minute window) to learn preferences
- **Quality validation** — Filters tracks by duration, keywords, channels, and special characters

### Data Persistence

- **Autoplay state** — Stored in `helpers/data/guildState.json` per guild
- **Playback history** — Last 20 tracks kept in memory (used for profiling)
- **Skip patterns** — In-memory Map with 30-minute expiry

### Testing

Run the autoplay test suite:

```bash
pnpm test:autoplay
```

Tests cover session profiling, duplicate detection, artist weight calculation, and edge cases.

---

## DJ Mode Overview

**DJ mode** restricts playback controls to users with a designated DJ role. Regular users can submit track suggestions that require DJ approval.

### Configuration

1. **Enable DJ mode:**

   ```
   /dj enable role:@DJ skipmode:hybrid threshold:50
   ```

2. **How it works:**

   - Users with the DJ role have full control
   - Non-DJs use `/play` to submit suggestions (appear in `/queue`)
   - DJ can approve/reject suggestions via buttons
   - Skip behavior depends on skip mode:
     - **dj**: Only DJ can skip
     - **vote**: Vote-based skip (50% threshold by default)
     - **hybrid**: Voting system, but DJ can override instantly

3. **Strict mode:**
   - `strict:true`: Only DJ role can manage DJ settings
   - `strict:false`: Server admins can also configure DJ mode

---

## Troubleshooting

### Bot doesn't come online

- Check Docker logs: `docker compose logs -f bot`
- Verify `DISCORD_TOKEN` and `CLIENT_ID` in `.env.prod`
- Ensure bot has been invited with `applications.commands` scope

### Slash commands don't appear

- Run `pnpm deploy:prod` to register commands
- Wait up to 1 hour for global commands to propagate
- For instant updates, use guild-specific deployment

### Lavalink connection fails

- Check Lavalink logs: `docker compose logs -f lavalink`
- Verify `LAVALINK_HOST=lavalink` in `.env.prod` (for Docker)
- Ensure health check passes: `docker compose ps`

### Music playback issues

- Verify Lavalink is healthy and connected
- Check for age-restricted content (requires YouTube tokens)
- Review bot logs for fallback attempts

### Autoplay not working

- Ensure `/autoplay` is enabled (check now-playing message)
- Verify Spotify credentials in `.env` (optional but recommended)
- Check logs for "Starting smart autoplay" messages
- Autoplay only triggers when queue is completely empty

### Data not persisting

- Ensure volume mounts in `docker-compose.yml`:
  ```yaml
  volumes:
    - ./helpers/data:/app/helpers/data
    - ./logs:/app/logs
  ```
- Check file permissions on host

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

1. Write tests for new features (`*.test.js`)
2. Run tests: `pnpm test`
3. Fix linting issues: `pnpm lint:fix`
4. Update help command and README if adding new commands

---

## License

This project is licensed under the **Educational & Research License** - see the [LICENSE](LICENSE) file for details.

⚠️ **Important:** This license restricts use to educational and research purposes only. It is NOT an open-source license and does NOT permit:

- Commercial use
- Public deployment
- Distribution as a service
- Any use that violates third-party Terms of Service

**You assume all legal responsibility** for how you use this code.

---

## Credits

- **Lavalink** - Audio streaming framework
- **Poru** - Lavalink client for Node.js
- **Discord.js** - Discord API library
- **Genius API** - Lyrics provider
- **Spotify Web API** - Recommendations engine

---

## Support

For issues, questions, or feature requests, please open an issue on [GitHub](https://github.com/Marczelloo/NeoBeat-Buddy/issues).

---

**Built with ❤️ for Discord music lovers.**
