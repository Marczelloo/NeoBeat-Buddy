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

A feature-rich Discord music bot powered by Lavalink and Poru, with DJ mode, adaptive genre-aware smart autoplay, advanced statistics, interactive EQ mixer, and seamless playlist support.

## Features

- **Slash-only interface** for queueing, playback, and moderation safeguards.
- **Deezer FLAC quality playback** — high-fidelity lossless audio as default source with automatic quality display.
- **Live autocomplete search** — get instant song suggestions as you type in `/play` command with Deezer-first results.
- **Search history tracking** — automatic history of all your searches with replay, search, export to playlist, and clear functions.
- **Session queue export** — save entire listening sessions (history + queue) as playlists for easy replay.
- **Adaptive smart autoplay** with Deezer recommendations — maintains genre consistency, tempo flow, time-aware energy adjustments, mood progression, and context-aware artist diversity.
- **24/7 radio mode** — bot stays in voice channel permanently and plays music continuously like a radio station.
- **Interactive EQ mixer panel** with 15-band control, A/B comparison, custom preset saving (up to 10 per user), real-time visual feedback, and 10-minute inactivity auto-cleanup.
- **DJ mode** with role-based permissions, skip voting (dj/vote/hybrid modes), and track suggestion approval workflow.
- **Real-time statistics** per guild and globally via `/stats` — tracks songs played, listening hours, unique users, peak listeners, top sources, and hourly activity patterns.
- **Lyrics lookup** for the current track with `/lyrics` (powered by Genius API).
- **Interactive queue management** with pagination, track removal by position or keyword, and shuffle.
- **Persistent state** — now playing messages, EQ configurations, DJ settings, guild stats, and autoplay preferences survive restarts.
- **Enhanced stability** — automatic voice region reconnection when Discord changes servers, improved duplicate prevention (tracks last 100 songs), and fixed fallback source playback.
- **Version announcements** — automatic patch notes delivered to servers when new versions are released, with `/changelog` to view any version and `/setup announcements` to configure channel and toggle notifications.
- **Age-restricted content handling** with automatic fallback to alternate sources.
- **Track history** with `/previous` command to replay or rewind.
- **Docker-based production stack** with health checks and auto-restart policies.
- **pnpm-first workflow** for fast, efficient dependency management.

## Requirements

- **Node.js** 20+ and **pnpm** 10+
- **Docker** & **Docker Compose** (for hosting Lavalink or the full stack)
- **Lavalink** 4.x credentials (see `.env-example`)
- **Deezer credentials** (required for FLAC playback, autoplay, and recommendations)
- **YouTube credentials** (required for OAuth authentication and age-restricted content)
- **Genius API key** (optional, for lyrics)

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
  Queue a track from YouTube, Spotify, or a search query with **live autocomplete suggestions** as you type. Use `prepend:true` to add it to the front of the queue.  
  _In DJ mode, non-DJs submit suggestions for approval._

- **`/pause`** — Pause the currently playing track (DJ restricted in DJ mode).
- **`/resume`** — Resume a paused track (DJ restricted in DJ mode).
- **`/stop`** — Stop playback and clear the queue (DJ only while DJ mode is enabled).
- **`/skip`** — Skip the current track or trigger vote-based skip depending on DJ mode configuration.
- **`/previous`** — Restart the current track or jump to the previous one from history (DJ restricted in DJ mode).
- **`/seekto position:<seconds|mm:ss|hh:mm:ss>`** — Jump to a specific timestamp in the current track (DJ restricted in DJ mode).
- **`/volume level:<0-100>`** — Set the playback volume (DJ only in DJ mode).
- **`/lyrics`** — Display lyrics for the currently playing song.
- **`/autoplay enable:<true|false>`** — Toggle adaptive genre-aware smart autoplay mode (DJ only).
- **`/247`** — Toggle 24/7 radio mode — bot stays in voice and plays continuously (DJ only).

---

### 📜 Queue & Looping

- **`/queue view`** — View the current queue with pagination controls. Pending DJ suggestions appear when DJ mode is active.
- **`/queue export name:<playlist> [include-current:true]`** — Export current session (queue + history) to a playlist. Saves all tracks played in current session plus queued tracks.
- **`/remove [position:<number>] [title:<keyword>]`** — Remove a specific track from the queue by position or title search (DJ only in DJ mode).
- **`/clearqueue`** — Remove every track from the queue (DJ only while DJ mode is enabled).
- **`/shuffle`** — Randomize the queue order (DJ restricted in DJ mode).
- **`/loop [mode:<NONE|TRACK|QUEUE>]`** — Toggle loop modes (DJ restricted in DJ mode).

---

### 🕒 Search History

- **`/history view [server-only:false]`** — View your recent searches with pagination. Shows track title, artist, duration, source, and time ago.
- **`/history replay number:<number> [prepend:false]`** — Replay a track from your search history by entry number (from `/history view`).
- **`/history search query:<search term>`** — Search your history for tracks by title or artist.
- **`/history export name:<playlist> [limit:50] [server-only:false]`** — Export search history to a playlist. Great for creating "Recently Played" playlists.
- **`/history clear [server-only:false]`** — Clear your search history. Optionally clear only this server's searches.

**How it works:**

- Every track you play with `/play` is automatically saved to your personal search history (up to 100 searches).
- Search history is per-user and persists across bot restarts.
- Filter by server to see only searches from the current server.
- Export to playlist to save your listening journey.

---

### 🤖 Smart Autoplay (Genre-Aware + Adaptive)

**Autoplay automatically discovers and queues music when your queue is empty, maintaining genre consistency, tempo flow, and natural energy progression throughout your listening session.**

#### How It Works

1. **Analyzes your listening history** — Tracks the last 15 songs played to understand your music taste, genre preferences, tempo patterns, and mood trends.

2. **Multi-source recommendations** — Pulls suggestions from:

   - **Deezer Recommendations (primary)** — Returns 40 high-quality recommendations based on the last track in your queue
   - **YouTube Mix** — Related tracks from YouTube's radio feature (fallback/supplement)
   - **Top artist search** — Songs from your most-played artists

3. **Genre consistency** — Maintains your music style:

   - Extracts genre information from Spotify API for each track (when available)
   - Tracks top genres across your listening session (e.g., "rock", "indie rock", "alternative")
   - **+30 point bonus** per matching genre in recommendations
   - **-25 point penalty** for tracks with no genre overlap when you have a strong genre profile
   - **-15 points** per genre you've skipped recently
   - Learns from your skips to avoid unwanted genres

4. **Advanced scoring system** — Ranks candidates using **12 intelligent factors**:

   - **Genre consistency** — Strongly favors tracks matching your recent genres (+30 per match)
   - **Tempo/BPM matching** — Maintains natural flow (+15 within 15 BPM, +8 within 30 BPM)
   - **Time-of-day awareness** — Adjusts energy for morning/afternoon/evening/night (+12 optimal, +6 acceptable)
   - **Popularity weighting** — Balances discovery vs. familiarity (+10 for 50-85 popularity, -5 for obscure, -3 for overplayed)
   - **Mood progression** — Continues or stabilizes valence (happiness) trends (+12 for trend continuation, +8 for stability)
   - **Energy arc management** — Builds, maintains, or winds down energy intentionally (+15 for trend, +10 for plateau)
   - **Artist familiarity** — How often you've played them (+5 per occurrence)
   - **Duration similarity** — Matches average song length (+10 within 20%, +5 within 40%)
   - **Source quality** — Deezer > YouTube Mix > Search (+35/+15/+10)
   - **Smart artist diversity** — Context-aware penalties that prioritize sonic cohesion over strict rotation
   - **Skip learning** — Downweights artists and genres you skip (-20/-15 per skip)
   - **Duplicate prevention** — Never plays the same song twice (-1000 penalty)

5. **Quality filtering** — Automatically rejects:
   - Non-music content (tutorials, poetry, spoken word)
   - Short clips (<30 seconds)
   - Videos with excessive hashtags or emojis
   - Known non-music channels

#### Genre Consistency Explained

**Before enhancement:**

```
Rock → Rock → Pop → Electronic → Hip-hop → ???
```

_Genre drifts significantly after 3-4 autoplay tracks_

**After enhancement:**

```
Rock → Indie Rock → Alternative Rock → Garage Rock → Rock Ballad
```

_Maintains genre consistency while introducing variety within the genre family_

**Example scoring:**

If you're listening to rock music:

- **"Seven Nation Army"** (genres: garage rock, alternative rock)

  - Base: 50 points
  - Deezer source: +35
  - Genre matches: +30 (garage rock) +30 (alternative rock)
  - Tempo match: +15 (within 15 BPM)
  - Energy arc: +15 (building)
  - Final: **~175 points** ✅

- **"Uptown Funk"** (genres: pop, funk)
  - Base: 50 points
  - Deezer source: +35
  - Genre drift penalty: -25 (no rock genres)
  - Tempo mismatch: -5 (too different)
  - Final: **~55 points** ❌

#### Advanced Features

**Tempo/BPM Consistency**

- Analyzes average tempo across your session
- Prefers tracks within 15 BPM (+15 points) or 30 BPM (+8 points)
- Creates natural rhythmic flow without jarring tempo changes
- Example: 128 BPM session → prefers 115-141 BPM range

**Time-of-Day Awareness**

- **Morning (6am-12pm)**: Moderate energy preference (0.6 factor)
- **Afternoon (12pm-6pm)**: High energy preference (0.75 factor)
- **Evening (6pm-10pm)**: Moderate energy preference (0.65 factor)
- **Night (10pm-6am)**: Low energy preference (0.4 factor)
- Automatically adjusts recommendations to match your daily rhythm

**Popularity Weighting**

- Sweet spot: 50-85 popularity (+10) — Popular but not overplayed
- Too obscure: <25 popularity (-5) — Harder to enjoy unfamiliar tracks
- Overplayed: >95 popularity (-3) — Avoids radio fatigue
- Balances discovery with accessibility

**Mood Progression**

- Detects valence (happiness) trend from last 5 tracks
- Continues upward mood trajectory (+12) — Building positive energy
- Continues downward trajectory (+12) — Deepening introspection
- Maintains stable mood (+8) — Consistent emotional tone
- Creates intentional emotional arcs

**Energy Arc Management**

- Detects energy trend: increasing/decreasing/stable
- Continues energy build-up (+15) — Escalating intensity
- Continues wind-down (+15) — Relaxing progression
- Maintains plateau (+10) — Sustained energy level
- Prevents abrupt energy shifts that break flow

#### Audio Feature Targeting

The algorithm uses Deezer recommendations to maintain consistency, with optional Spotify metadata enrichment for tempo and energy analysis when credentials are configured.

#### Smart Artist Diversity (Context-Aware)

Unlike simple artist rotation, the new diversity system **prioritizes sonic cohesion** while preventing monotony:

**"Vibe Match" Scoring:**

- Calculates how well a track matches your session on 4 factors:
  - **Genre** (25 points) — Shares genres with listening history?
  - **Tempo** (25 points) — BPM within 20-40 of average?
  - **Energy** (25 points) — Energy level aligns?
  - **Mood** (25 points) — Valence (happiness) matches?
- Combined into a 0-100 "vibe match score"

**Three-Tier Penalty System:**

1. **Last Track (Consecutive):** -40 penalty (prevents back-to-back plays of same artist)
2. **Last 3 Tracks (Recent):**
   - Vibe ≥80%: -8 penalty (allows if excellent match)
   - Vibe ≥60%: -18 penalty (moderate restriction)
   - Vibe <60%: -30 penalty (heavy restriction)
3. **Top 3 Artists Overall (Not in Last 3):**
   - Vibe ≥80%: -5 penalty ✅ (very lenient — prioritizes genre/tempo/energy match)
   - Vibe ≥60%: -12 penalty (reasonable)
   - Vibe 40-60%: -20 penalty (discouraged)
   - Vibe <40%: -30 penalty (heavily discouraged)
   - Extra -10 if it's the #1 most frequent artist

**What This Achieves:**

- ✅ Same artist CAN play if genre/tempo/energy/mood match excellently
- ✅ Prevents monotony — won't play same artist back-to-back
- ✅ Balanced diversity — encourages variety but prioritizes vibe consistency
- ✅ Genre-focused — if you're in a hip-hop session, it'll stick to hip-hop even if same artist

**Example:**

If you're listening to rock:

- **"Smells Like Teen Spirit"** (Nirvana) → plays
- Next autoplay finds **another Nirvana track**:
  - Vibe match: 85% (genre + tempo + energy all match)
  - Penalty: Only -5 (allowed because vibe is excellent)
  - ✅ Will likely play if it scores high on other factors
- But if autoplay tries to queue Nirvana **again** right after:
  - Penalty: -40 (consecutive play prevention)
  - ❌ Won't play even with perfect vibe match

#### Usage

```bash
# Enable autoplay (DJ permission required)
/autoplay

# Autoplay status shows in the now-playing message
```

**When enabled**, autoplay triggers automatically when the queue ends, seamlessly continuing your listening session with curated recommendations that match your genre preferences, tempo flow, mood, and energy levels.

**Note:** Deezer credentials are required for the best autoplay experience with genre consistency. Without Deezer, the bot falls back to YouTube Mix recommendations (no genre awareness). Spotify credentials are optional and only used for metadata enrichment.

---

### 📻 24/7 Radio Mode

**Turn your bot into a 24/7 radio station** that stays in voice and plays music continuously.

#### How It Works

1. **Enable 24/7 mode:**

   ```
   /247
   ```

2. **What happens:**

   - Bot stays in voice channel permanently (even when alone)
   - Automatically queues tracks when queue ends (uses smart autoplay algorithm)
   - Ignores inactivity timers
   - Continues playing based on listening history

3. **Requirements:**

   - Bot must be in voice with at least one track played
   - Needs listening history to generate recommendations
   - DJ permission required

4. **Disable:**
   - Use `/247` again to toggle off
   - Or use `/stop` to stop music and disable 24/7 mode

#### Use Cases

- **Community servers**: Background music running 24/7
- **Study/work servers**: Continuous lo-fi or ambient music
- **Music-focused servers**: Non-stop radio experience

**Note:** 24/7 state is NOT saved across restarts to prevent auto-join issues on startup.

---

### 📋 Playlists

**Create and manage custom playlists** for organizing your favorite tracks, sharing with friends, and building collaborative music collections.

#### Playlist Management

- **`/playlist create name:<name> [type:user|server] [public:false] [description:text] [collaborative:false]`**  
  Create a new playlist.

  - **User playlists**: Personal playlists (default), can be made public or shared.
  - **Server playlists**: Available to everyone in the server.
  - **Collaborative mode**: Allow collaborators to add/remove tracks.

- **`/playlist list [filter:all|user|server|shared] [user:@someone]`**  
  View your playlists or another user's public playlists with filtering options.

- **`/playlist view name:<playlist>`**  
  Display all tracks in a playlist with **pagination controls** (Next/Previous buttons to browse through all tracks).

- **`/playlist play name:<playlist> [shuffle:false] [prepend:false]`**  
  Load an entire playlist into the queue. DJ permission required for server playlists when DJ mode is active.

- **`/playlist add name:<playlist> [track:query]`**  
  Add the currently playing track to a playlist, or **search for a track** using autocomplete suggestions (same as `/play`).

- **`/playlist remove name:<playlist> position:<number>`**  
  Remove a track from a playlist by its position (1-based).

- **`/playlist rename old:<name> new:<name>`**  
  Rename a playlist (owner only).

- **`/playlist move name:<playlist> from:<position> to:<position>`**  
  Reorder tracks within a playlist.

- **`/playlist edit name:<playlist> [description:text] [public:true|false] [collaborative:true|false]`**  
  Update playlist settings (owner only).

- **`/playlist delete name:<playlist>`**  
  Delete a playlist permanently (owner only).

- **`/like`**  
  Add or remove the currently playing track from your **Liked Songs** playlist. If the track is already liked, you'll be prompted to confirm removal. The like button is also available on the player embed.

#### Sharing & Collaboration

- **`/playlist share name:<playlist> [user:@someone]`**  
  Share a playlist:

  - **Generate share code**: 8-character code valid for 24 hours that anyone can use to import the playlist.
  - **Share with user**: Grant a specific user access to view and play the playlist.

- **`/playlist import source:<code or URL> [name:custom name]`**  
  Import a playlist from:

  - **Share code**: Import from an 8-character code
  - **Spotify URL**: Import playlists directly from Spotify (extracts thumbnails automatically)
  - **YouTube URL**: Import YouTube playlists with full metadata

- **`/playlist collaborators name:<playlist> [add:@user] [remove:@user]`**  
  Manage playlist collaborators. Collaborators can add/remove tracks if collaborative mode is enabled.

- **`/playlist merge target:<playlist> source:<playlist>`**  
  Merge two playlists by copying all tracks from source to target.

#### Special Features

**Liked Songs**

- Automatically created when you like your first track
- Protected from deletion and renaming
- Quick access via `/like` command or like button (❤️) on player embed
- View with `/playlist view name:Liked Songs`

**Playlist Thumbnails**

- Automatically extracted when importing from Spotify or YouTube
- Displayed in playlist view embed
- Shows album art or playlist artwork

**Autocomplete Search**

- `/playlist add` supports track search with live autocomplete (same as `/play`)
- Type to search YouTube and get instant suggestions
- Add tracks without needing to play them first

**Pagination**

- Playlist view shows 15 tracks per page
- Use Next/Previous buttons to navigate through all tracks
- Clean, organized interface for large playlists

#### Permissions

**Owner-only actions:**

- Delete, rename, edit settings
- Manage collaborators
- Change collaborative mode

**Collaborator actions (if collaborative mode enabled):**

- Add tracks
- Remove tracks

**Public playlist access:**

- Anyone can view and play
- Only owner/collaborators can modify

**DJ Mode integration:**

- Only DJs can play server playlists when DJ mode is active
- Non-DJs can still manage their user playlists

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
  - **10-minute inactivity timer**: Panel auto-deletes after 10 minutes of no interaction (prevents channel clutter)
  - **Smart panel refresh**: Deletes old panel and creates new one to keep it visible at bottom of chat
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

- **`/changelog [version:<version>]`**  
  View patch notes for the current version or a specific version with navigation controls. Shows categorized features, fixes, and changes with links to GitHub.

- **`/setup announcements channel:<channel>`** — Configure announcement channel for new version notifications (requires Manage Guild permission).
- **`/setup announcements enable`** — Enable automatic version announcements for this server.
- **`/setup announcements disable`** — Disable automatic version announcements for this server.
- **`/setup announcements status`** — View current announcement configuration.

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
   DEEZER_ARL_TOKEN=your-deezer-arl-token
   DEEZER_MASTER_KEY=g4el58wc0zvf9na1
   SPOTIFY_CLIENT_ID=your-spotify-id  # Optional
   SPOTIFY_CLIENT_SECRET=your-spotify-secret  # Optional
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

### Required for Full Functionality

| Variable                | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `DEEZER_ARL_TOKEN`      | Deezer ARL cookie for FLAC playback and recommendations |
| `DEEZER_MASTER_KEY`     | Deezer master decryption key (use: g4el58wc0zvf9na1)    |
| `YOUTUBE_PO_TOKEN`      | YouTube PO token for OAuth authentication               |
| `YOUTUBE_VISITOR_DATA`  | YouTube visitor data for OAuth                          |
| `YOUTUBE_REFRESH_TOKEN` | YouTube OAuth refresh token                             |

### Optional

| Variable                      | Default  | Description                                           |
| ----------------------------- | -------- | ----------------------------------------------------- |
| `GENIUS_API_KEY`              | -        | Genius API key for lyrics lookup                      |
| `SPOTIFY_CLIENT_ID`           | -        | Spotify client ID (optional, for metadata enrichment) |
| `SPOTIFY_CLIENT_SECRET`       | -        | Spotify client secret                                 |
| `DEFAULT_VOLUME`              | `50`     | Default playback volume (0-100)                       |
| `INACTIVITY_TIMEOUT_MS`       | `300000` | Inactivity timeout in ms (5 minutes)                  |
| `PROGRESS_UPDATE_INTERVAL_MS` | `10000`  | Player progress update interval (10 seconds)          |
| `TRACK_HISTORY_LIMIT`         | `20`     | Max tracks to keep in history                         |
| `FAST_LOGS`                   | `1`      | Enable fast logging (0 to disable)                    |
| `LOG_TO_FILE`                 | `1`      | Enable file logging (0 to disable)                    |

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
│   │   ├── equalizer.json
│   │   └── customPresets.json
│   ├── dj/             # DJ mode logic
│   ├── equalizer/      # EQ presets, mixer panel, custom presets
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

## Technical Deep Dives

### Smart Autoplay Architecture

#### Session Profiling

- Analyzes last 15 tracks for artist frequency, genre distribution, and average duration
- Extracts genre information from Spotify API (e.g., "indie rock", "alternative rock")
- Calculates average audio features (energy, danceability, valence, acousticness, tempo)
- Detects energy and mood (valence) trends: increasing, decreasing, or stable
- Calculates average release year and tempo (BPM)
- Builds a comprehensive listening profile used for scoring candidates

#### Multi-Source Candidate Collection

1. **Deezer Recommendations** (primary)

   - Uses Deezer's recommendation algorithm based on seed track
   - Returns 40 high-quality recommendations with full metadata
   - Fast and reliable - no additional API calls needed
   - Provides artist, title, duration, and track identifiers

2. **YouTube Mix** (fallback/supplement)

   - Uses YouTube's radio playlist feature
   - Provides 20 related tracks
   - No genre/tempo/mood information available

3. **Top Artist Search** (supplement)
   - Searches for songs by your most-played artists
   - Only used when strong genre profile exists

#### 12-Factor Scoring System

Each candidate receives a score based on:

| Factor                 | Points          | Description                                                   |
| ---------------------- | --------------- | ------------------------------------------------------------- |
| **Genre Match**        | +30 per genre   | Matching genre from your top genres (weighted by frequency)   |
| **Genre Drift**        | -25             | No genre overlap when you have ≥3 top genres                  |
| **Tempo/BPM Match**    | +15 / +8 / -5   | Within 15 BPM (+15), 30 BPM (+8), or >60 BPM (-5)             |
| **Time-of-Day**        | +12 / +6        | Energy matches time of day (optimal +12, acceptable +6)       |
| **Popularity**         | +10 / -5 / -3   | Sweet spot 50-85 (+10), obscure <25 (-5), overplayed >95 (-3) |
| **Mood Progression**   | +12 / +8        | Continues valence trend (+12) or maintains stability (+8)     |
| **Energy Arc**         | +15 / +10       | Continues energy trend (+15) or maintains plateau (+10)       |
| **Artist Familiarity** | +5 per play     | How often you've played this artist                           |
| **Duration Match**     | +10 / +5 / -5   | Within 20% (+10), 40% (+5), or >40% (-5) of average           |
| **Source Quality**     | +35 / +15 / +10 | Deezer (+35), YouTube Mix (+15), Search (+10)                 |
| **Smart Diversity**    | +20 / -5 to -40 | Context-aware: vibe match reduces penalty, consecutive -40    |
| **Skip Learning**      | -20 per skip    | Artist you've skipped recently (30min window)                 |
| **Genre Skip**         | -15 per skip    | Genre you've skipped recently                                 |
| **Duplicate**          | -1000           | Already played in last 100 tracks (ID + title/artist match)   |

#### Time-of-Day Energy Factors

| Time Period          | Energy Factor | Preference      |
| -------------------- | ------------- | --------------- |
| Morning (6am-12pm)   | 0.6           | Moderate energy |
| Afternoon (12pm-6pm) | 0.75          | High energy     |
| Evening (6pm-10pm)   | 0.65          | Moderate energy |
| Night (10pm-6am)     | 0.4           | Low energy      |

#### Trend Detection

**Energy Trend** (last 5 tracks):

- Calculates average energy of first half vs. second half
- **Increasing**: Difference > 0.1 → Prefers higher energy
- **Decreasing**: Difference < -0.1 → Prefers lower energy
- **Stable**: Difference between -0.1 and 0.1 → Maintains current level

**Mood Trend (Valence)** (last 5 tracks):

- Calculates average valence of first half vs. second half
- **Increasing**: Difference > 0.1 → Prefers happier/more positive tracks
- **Decreasing**: Difference < -0.1 → Prefers mellower/introspective tracks
- **Stable**: Difference between -0.1 and 0.1 → Maintains current mood

#### Caching & Performance

- **Genre cache**: Stores genre information for tracks to avoid redundant API calls
- **Audio features cache**: Maps YouTube identifier → {genres, features, releaseYear}
- **Session tracking**: Monitors session start time for long-session adjustments
- **Skip history**: 30-minute memory window with genre tracking
- Persists in memory during bot runtime (cleared on restart)

#### Data Persistence

- **Autoplay state**: Stored in `helpers/data/guildState.json` per guild
- **Playback history**: Last 20 tracks in memory (used for profiling)
- **Skip patterns**: In-memory Map with 30-minute expiry, includes genres
- **Genre cache**: In-memory Map (cleared on restart)
- **Session start time**: In-memory Map for long-session detection

#### Detailed Logging

Enhanced logging provides full transparency:

- Top candidate with complete scoring breakdown
- Tempo, energy, genres, popularity for winner
- Individual scoring factors with point values
- Energy/mood trends and time-of-day adjustments
- Session profile summary (top genres, avg tempo, avg year, trends)

Example log output:

```
Session profile built: tracks=15, topGenres=rock(5), indie rock(4), alternative(3),
avgTempo=128BPM, avgYear=2015, energyTrend=increasing, timeOfDay=afternoon

Top candidates scored: winner=Arctic Monkeys - Do I Wanna Know? (167)
scoring=source:+30, genre:+60, tempo:+15, energyArc:+15, timeOfDay:+12,
popularity:+10, diversity:+20, artist:+5
```

### Testing

Run the autoplay test suite:

```bash
pnpm test:autoplay
```

Tests cover session profiling, genre scoring, tempo matching, duplicate detection, artist weight calculation, and edge cases.

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
- Ensure Spotify credentials are configured for best autoplay results
- Check Lavalink node status and logs if playback fails

---

## 🔧 Reliability & Stability

### Voice Region Reconnection

When Discord changes the voice channel region (moving to a different voice server), the bot automatically:

- Detects the region change via `channelUpdate` event
- Saves complete playback state (track, position, queue, volume, loop mode)
- Destroys old connection and creates a fresh one to the new region
- Restores all settings and resumes playback from the exact position
- **No interruption** to the listening experience

---

## Troubleshooting

### Autoplay not working or genre drifting

- Ensure `/autoplay` is enabled (check now-playing message)
- **Verify Deezer credentials** in `.env` — `DEEZER_ARL_TOKEN` and `DEEZER_MASTER_KEY` required for recommendations
- Check logs for "Starting smart autoplay" and "Collected Deezer recommendations" messages
- Autoplay only triggers when queue is completely empty
- Without Deezer: Falls back to YouTube Mix (may drift genres)
- Check Lavalink logs for Deezer authentication errors

### EQ or custom presets not saving

- Check for "Failed to save" errors in logs
- Ensure `helpers/data/` directory exists and is writable
- Verify no BigInt serialization errors (fixed in latest version)
- Check Docker volume mounts if using containers

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
- **Spotify Web API** - Genre-aware recommendations and audio feature analysis

---

## Support

For issues, questions, or feature requests, please open an issue on [GitHub](https://github.com/Marczelloo/NeoBeat-Buddy/issues).

---

**Built with ❤️ for Discord music lovers.**
