module.exports = {
  DEFAULT_CATEGORY: "playback",
  CATEGORIES: {
    playback: {
      label: "Playback Control",
      description: "Start playback, manage the current track, and view lyrics.",
      emoji: "🎶",
      commands: [
        {
          name: "play",
          description:
            "Queue a track from a URL or search query with autocomplete suggestions. In DJ mode, non-DJs submit suggestions for approval.",
          usage: "/play query:<song or url> [prepend:true]",
        },
        {
          name: "pause",
          description: "Pause the currently playing track (DJ/strict permissions apply).",
          usage: "/pause",
        },
        {
          name: "resume",
          description: "Resume a paused track (DJ/strict permissions apply).",
          usage: "/resume",
        },
        {
          name: "stop",
          description: "Stop playback and clear the queue (DJ only while DJ mode is enabled).",
          usage: "/stop",
        },
        {
          name: "skip",
          description: "Skip the current track or trigger a vote depending on DJ mode configuration.",
          usage: "/skip",
        },
        {
          name: "previous",
          description: "Restart the current track or play the previous one (DJ restricted in DJ mode).",
          usage: "/previous",
        },
        {
          name: "seekto",
          description:
            "Jump to a specific timestamp in the current track (DJ restricted in DJ mode). Accepts flexible formats: 90, 3:00, or 1:30:45.",
          usage: "/seekto position:<seconds|m:ss|mm:ss|h:mm:ss>",
        },
        {
          name: "volume",
          description: "Set the playback volume between 0 and 100 (DJ only in DJ mode).",
          usage: "/volume level:<0-100>",
        },
        {
          name: "lyrics",
          description: "Display lyrics for the currently playing song.",
          usage: "/lyrics",
        },
        {
          name: "autoplay",
          description:
            "Toggle smart autoplay mode that automatically queues similar tracks when the queue ends (DJ only).",
          usage: "/autoplay enable:<true|false>",
        },
        {
          name: "247",
          description:
            "Toggle 24/7 radio mode - bot stays in voice channel and plays continuously like a radio station (DJ only).",
          usage: "/247",
        },
        {
          name: "like",
          description: "Add the currently playing track to your Liked Songs playlist.",
          usage: "/like",
        },
      ],
    },
    playlists: {
      label: "Playlists",
      description: "Create, manage, share, and play custom playlists.",
      emoji: "📋",
      commands: [
        {
          name: "playlist create",
          description: "Create a new user or server playlist.",
          usage:
            "/playlist create name:<name> [type:user|server] [public:false] [description:text] [collaborative:false]",
        },
        {
          name: "playlist list",
          description: "View your playlists or another user's public playlists.",
          usage: "/playlist list [filter:all|user|server|shared] [user:@someone]",
        },
        {
          name: "playlist view",
          description:
            "View all tracks in a playlist with pagination controls. Use Next/Previous buttons to browse through all tracks (15 per page).",
          usage: "/playlist view name:<playlist>",
        },
        {
          name: "playlist play",
          description: "Load playlist into queue. DJ permission required for server playlists in DJ mode.",
          usage: "/playlist play name:<playlist> [shuffle:false] [prepend:false]",
        },
        {
          name: "playlist add",
          description:
            "Add the current track or search for a track to add to playlist. Track search supports autocomplete suggestions (same as /play).",
          usage: "/playlist add name:<playlist> [track:query or URL]",
        },
        {
          name: "playlist remove",
          description: "Remove a track from playlist by position (1-based).",
          usage: "/playlist remove name:<playlist> position:<number>",
        },
        {
          name: "playlist rename",
          description: "Rename a playlist.",
          usage: "/playlist rename old:<name> new:<name>",
        },
        {
          name: "playlist move",
          description: "Reorder tracks within a playlist.",
          usage: "/playlist move name:<playlist> from:<position> to:<position>",
        },
        {
          name: "playlist edit",
          description: "Update playlist description, visibility, or collaboration settings.",
          usage: "/playlist edit name:<playlist> [description:text] [public:true|false] [collaborative:true|false]",
        },
        {
          name: "playlist collaborators",
          description: "Add or remove collaborators from a playlist.",
          usage: "/playlist collaborators name:<playlist> [add:@user] [remove:@user]",
        },
        {
          name: "playlist merge",
          description: "Merge two playlists (copies tracks from source to target).",
          usage: "/playlist merge target:<playlist> source:<playlist>",
        },
        {
          name: "playlist share",
          description: "Share playlist with a specific user or generate a share code.",
          usage: "/playlist share name:<playlist> [user:@someone]",
        },
        {
          name: "playlist import",
          description: "Import a playlist from a share code, Spotify URL, or YouTube URL.",
          usage: "/playlist import source:<code or URL> [name:custom name]",
        },
      ],
      notes: [
        {
          name: "Playlist Types",
          value: [
            "- **User Playlists**: Personal playlists visible only to you by default.",
            "  - Can be made public for others to view and play.",
            "  - Can be shared with specific users or via share codes.",
            "- **Server Playlists**: Available to everyone in the server.",
            "  - Anyone can create server playlists.",
            "  - In DJ mode, only DJs can play server playlists.",
            "- Both types support collaborative mode for shared editing.",
          ].join("\n"),
        },
        {
          name: "Liked Songs",
          value: [
            "- Use `/like` while a track is playing to add it to your personal Liked Songs playlist.",
            "- Liked Songs is automatically created for each user when they like their first track.",
            "- View your Liked Songs with `/playlist view name:Liked Songs`.",
            "- Play your Liked Songs like any other playlist: `/playlist play name:Liked Songs`.",
          ].join("\n"),
        },
        {
          name: "Sharing & Collaboration",
          value: [
            "- **Share Codes**: Generate a code with `/playlist share` (expires in 24 hours).",
            "  - Anyone can import the playlist with `/playlist import code:<code>`.",
            "  - Imported playlists become the importer's personal copy.",
            "- **User Sharing**: Share directly with specific users using `/playlist share user:@someone`.",
            "  - Shared users can view and play the playlist.",
            "  - Owner must enable collaborative mode for others to edit.",
            "- **Collaborative Mode**: Enable with `/playlist edit collaborative:true`.",
            "  - Allows collaborators and shared users to add/remove tracks.",
            "  - Only the owner can delete, rename, or change settings.",
          ].join("\n"),
        },
        {
          name: "Permissions",
          value: [
            "- **Owner-only actions**: Delete, rename, edit settings, manage collaborators.",
            "- **Collaborator actions**: Add/remove tracks (if collaborative mode enabled).",
            "- **Public playlists**: Anyone can view and play, but only owner/collaborators can modify.",
            "- **DJ Mode**: Only DJs can use `/playlist play` on server playlists when DJ mode is active.",
          ].join("\n"),
        },
      ],
    },
    queue: {
      label: "Queue & Looping",
      description: "Inspect and reorder what is coming up next.",
      emoji: "📜",
      commands: [
        {
          name: "queue",
          description:
            "Show the current queue with pagination controls. Pending DJ suggestions appear when DJ mode is active.",
          usage: "/queue",
        },
        {
          name: "remove",
          description: "Remove a specific track from the queue by position or title (DJ only in DJ mode).",
          usage: "/remove [position:<number>] [title:<keyword>]",
        },
        {
          name: "clearqueue",
          description: "Remove every track from the queue (DJ only while DJ mode is enabled).",
          usage: "/clearqueue",
        },
        {
          name: "shuffle",
          description: "Shuffle the order of the queued tracks (DJ restricted in DJ mode).",
          usage: "/shuffle",
        },
        {
          name: "loop",
          description: "Toggle loop mode for the current track or queue (DJ restricted in DJ mode).",
          usage: "/loop [mode:<NONE|TRACK|QUEUE>]",
        },
      ],
      notes: [
        {
          name: "Smart Autoplay",
          value: [
            "- Autoplay automatically finds and queues similar tracks when your queue is empty.",
            "- Uses Spotify recommendations and YouTube Mix to discover music matching your listening history.",
            "- Learns from your listening patterns: tracks last 15 songs played and avoids artist clustering.",
            "- Filters out non-music content (tutorials, poetry, shorts) for quality recommendations.",
            "- Learns from skips: tracks you skip are downweighted in future recommendations.",
            "- Toggle with `/autoplay` (DJ permission required).",
          ].join("\n"),
        },
        {
          name: "24/7 Radio Mode",
          value: [
            "- Toggle with `/247` to turn your bot into a 24/7 radio station (DJ only).",
            "- **What it does**: Bot stays in voice channel permanently and plays music continuously.",
            "- **Auto-queue**: Automatically queues tracks based on listening history when queue ends.",
            "- **No disconnects**: Bot ignores inactivity timers and stays even when alone in channel.",
            "- **Disable**: Use `/247` again or `/stop` to turn off 24/7 mode.",
            "- **Perfect for**: Community servers that want background music running all day.",
            "- Note: 24/7 state is NOT saved across restarts (prevents auto-join issues).",
          ].join("\n"),
        },
      ],
    },
    filters: {
      label: "Equalizer & Effects",
      description: "Tune the audio output with presets or per-band adjustments.",
      emoji: "🎚️",
      commands: [
        {
          name: "eqpanel",
          description: "Open the interactive 15-band EQ mixer panel with real-time controls.",
          usage: "/eqpanel",
        },
        {
          name: "eq preset",
          description: "Apply a built-in or custom equalizer preset using autocomplete.",
          usage: "/eq preset name:<preset>",
        },
        {
          name: "eq list",
          description: "View all 22 built-in equalizer presets organized by category.",
          usage: "/eq list",
        },
        {
          name: "eq mypresets",
          description: "View all your saved custom presets with usage examples.",
          usage: "/eq mypresets",
        },
        {
          name: "eq delete",
          description: "Delete one of your custom presets using autocomplete.",
          usage: "/eq delete name:<preset>",
        },
        {
          name: "eq reset",
          description: "Reset the equalizer back to a flat response.",
          usage: "/eq reset",
        },
      ],
      notes: [
        {
          name: "Interactive Mixer Panel",
          value: [
            "- Use `/eqpanel` to open a fully interactive 15-band equalizer mixer.",
            "- **Per-band control**: Use ▲/▼ buttons to select which band to adjust (0-14).",
            "- **Gain adjustment**: Use + / ++ / -- / - buttons to fine-tune the selected band.",
            "  - Single press: ±1.0dB increments",
            "  - Shift press: ±0.5dB increments",
            "- **A/B Comparison**: Save a snapshot with 💾, then use 🔄 to toggle between current and saved settings.",
            "- **Save Custom Presets**: Use 📁 to save your current EQ as a custom preset (up to 10 per user).",
            "- **Visual Feedback**: Horizontal bars show gain levels (-12dB to +6dB) with selected band marked by ►.",
            "- **Throttled Updates**: Changes are batched (200ms) to prevent Lavalink spam.",
          ].join("\n"),
        },
        {
          name: "Custom Presets",
          value: [
            "- Save your favorite EQ configurations with `/eqpanel` → 📁 Save Preset button.",
            "- Preset names must be alphanumeric (3-20 characters, no spaces): e.g., `mybass`, `gaming1`.",
            "- Load your presets with `/eq preset` - autocomplete shows both built-in and custom presets.",
            "- View all your saved presets with `/eq mypresets`.",
            "- Delete unwanted presets with `/eq delete` - autocomplete filters your custom presets.",
            "- Limit: 10 custom presets per user.",
          ].join("\n"),
        },
        {
          name: "Built-in Presets (22 total)",
          value: [
            "**General**: flat, acoustic, classical, piano, vocal, podcast, smallspeakers",
            "**Genre-Based**: pop, rock, jazz, dance, electronic, edm, hiphop, rnb, latin",
            "**Bass & Treble**: bass, bassboost, deep, treble",
            "**Special**: lofi, nightcore",
            "Use `/eq list` to see all presets with descriptions.",
          ].join("\n"),
        },
      ],
    },
    utility: {
      label: "Utility",
      description: "Stats, diagnostics, and DJ mode management.",
      emoji: "🛠️",
      commands: [
        {
          name: "stats",
          description: "Show per-guild and global playback statistics.",
          usage: "/stats",
        },
        {
          name: "changelog",
          description:
            "View patch notes for the current version or a specific version. Navigate between versions with interactive buttons.",
          usage: "/changelog [version:<version>]",
        },
        {
          name: "setup announcements",
          description:
            "Configure automatic version announcements: set channel, enable/disable, view status, or reset state for testing.",
          usage:
            "\n/setup announcements channel channel:<channel>\n/setup announcements enable\n/setup announcements disable\n/setup announcements status\n/setup announcements reset",
        },
        {
          name: "user",
          description: "Inspect a user's profile, flags, and status.",
          usage: "/user user:<member>",
        },
        {
          name: "dj",
          description:
            "Configure DJ mode: enable/disable, assign the DJ role, toggle strict permissions, and adjust skip voting.",
          usage:
            "\n/dj enable role:<role> [skipmode:<mode>] [threshold:<10-100>]\n/dj disable\n/dj setrole role:<role>\n/dj skipmode mode:<mode> [threshold:<10-100>]\n/dj permissions strict:<true|false>\n/dj status",
        },
        {
          name: "help",
          description: "Open the interactive help menu.",
          usage: "/help",
        },
      ],
      notes: [
        {
          name: "Version Announcements",
          value: [
            "- The bot automatically announces new versions when it starts up.",
            "- Configure where announcements are sent with `/setup announcements channel`.",
            "- View patch notes anytime with `/changelog` - navigate between versions with interactive buttons.",
            "- Enable/disable announcements per server with `/setup announcements enable/disable`.",
            "- Check current configuration with `/setup announcements status`.",
            "- For testing: `/setup announcements reset` clears announcement state to resend current version.",
          ].join("\n"),
        },
        {
          name: "DJ Mode Overview",
          value: [
            "- Enable DJ mode with `/dj enable`. Supply an existing role or leave it blank to have the bot create **DJ** automatically.",
            "- When DJ mode is on, only the DJ role controls playback/queue actions; everyone else submits `/play` suggestions for approval.",
            "- `/dj skipmode` chooses how skip requests behave: `dj` (DJ decides), `vote` (threshold-based votes), or `hybrid` (vote first, DJ fallback).",
            "- `/dj permissions strict:true` locks DJ management to the DJ role; `false` lets server managers help.",
            "- `/dj status` shows the current role, skip mode, vote threshold, and strict mode state.",
          ].join("\n"),
        },
      ],
    },
  },
};
