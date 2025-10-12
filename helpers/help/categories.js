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
          description: "Queue a track from a URL or search query. In DJ mode, non-DJs submit suggestions for approval.",
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
          description: "Jump to a specific timestamp in the current track (DJ restricted in DJ mode).",
          usage: "/seekto position:<seconds|mm:ss|hh:mm:ss>",
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
