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
            "Queue a track from a URL or search query with autocomplete suggestions. Choose search source (Auto/Deezer/YouTube/Spotify). In DJ mode, non-DJs submit suggestions for approval.",
          usage: "/play query:<song or url> [source:<Auto|Deezer|YouTube|Spotify>] [prepend:true]",
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
          description: "Display lyrics for the currently playing song. Use synced option for live updating lyrics.",
          usage: "/lyrics [synced:true|false]",
          notes:
            "• Synced lyrics update in real-time with highlighted current line (if available from Deezer/LRC Library)\n" +
            "• Static lyrics show full text (fallback to Genius if synced unavailable)\n" +
            "• Player button defaults to synced display for better experience\n" +
            "• Sources: Deezer → LRC Library → Genius",
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
      notes: [
        {
          name: "Music Source Selection",
          value: [
            "- Choose your preferred music source in `/play` command: Auto, Deezer, YouTube, or Spotify.",
            "- **Auto Mode** (default): Combines Deezer and YouTube results for maximum variety and quality.",
            "- **Deezer**: FLAC lossless quality audio - best for high-fidelity listening.",
            "- **YouTube**: Largest music catalog with remixes, covers, and rare tracks.",
            "- **Spotify**: Curated playlists and albums (requires Spotify link or exact name).",
            "- Set server-wide default with `/setup source default` - users can still override per-query.",
            "- **Position-independent**: Select source before or after typing your query - autocomplete adapts automatically.",
            "- **Smart fallback**: If primary source fails, bot automatically tries YouTube as backup.",
          ].join("\n"),
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
          name: "queue view",
          description:
            "Show the current queue with pagination controls. Pending DJ suggestions appear when DJ mode is active.",
          usage: "/queue view",
        },
        {
          name: "queue export",
          description:
            "Export current session (queue + history) to a playlist. Saves all tracks played in current session plus queued tracks.",
          usage: "/queue export name:<playlist name> [include-current:true]",
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
        {
          name: "history view",
          description: "View your recent searches with pagination. Filter to show only server searches or all.",
          usage: "/history view [server-only:false]",
        },
        {
          name: "history replay",
          description: "Replay a track from your search history by entry number.",
          usage: "/history replay number:<number> [prepend:false]",
        },
        {
          name: "history search",
          description: "Search your history for tracks by title or artist.",
          usage: "/history search query:<search term>",
        },
        {
          name: "history export",
          description: "Export search history to a playlist. Optionally limit tracks or filter by server.",
          usage: "/history export name:<playlist> [limit:50] [server-only:false]",
        },
        {
          name: "history clear",
          description: "Clear your search history. Optionally clear only server searches.",
          usage: "/history clear [server-only:false]",
        },
      ],
      notes: [
        {
          name: "Search History",
          value: [
            "- Every track you play with `/play` is saved to your personal search history (up to 100 searches).",
            "- View your history with `/history view` - shows track title, artist, duration, source, and time ago.",
            "- Replay any track from history with `/history replay number:<number>` (from history view).",
            "- Search your history by track title or artist with `/history search`.",
            "- Export your history to a playlist with `/history export` - great for creating 'Recently Played' playlists.",
            "- Clear history with `/history clear` - option to clear only this server's searches or all.",
            "- Server filter: Use `server-only:true` to see only searches from the current server.",
          ].join("\n"),
        },
        {
          name: "Queue Export",
          value: [
            "- Use `/queue export` to save your entire listening session as a playlist.",
            "- Includes: Previously played tracks (history) + currently playing track + queued tracks.",
            "- Perfect for saving a great DJ mix or music discovery session.",
            "- Option to exclude current track with `include-current:false`.",
            "- Creates a new user playlist that you can replay anytime with `/playlist play`.",
          ].join("\n"),
        },
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
          description: "Show per-guild and global playback statistics. Use detailed:true for more insights.",
          usage: "/stats [detailed:<true|false>]",
        },
        {
          name: "wrapped",
          description:
            "View your personal music wrapped or server-wide listening statistics with top tracks, artists, and insights.",
          usage: "/wrapped me [user:<user>]\n/wrapped server",
        },
        {
          name: "health",
          description:
            "View bot health and system metrics (Admin only). Check status, metrics, recent errors, or reset counters.",
          usage: "/health status\n/health metrics\n/health errors [limit:<1-20>]\n/health reset",
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
          name: "setup source",
          description:
            "Configure default music search source: server-wide default, personal preference, or view settings.",
          usage:
            "/setup source server source:<deezer|youtube|spotify>\n/setup source me source:<server|deezer|youtube|spotify>\n/setup source status",
        },
        {
          name: "logs setup",
          description:
            "Set up automatic server logging. Creates log category and channels for messages, voice, server events, and bot commands.",
          usage: "/logs setup [access-role:<role>]",
        },
        {
          name: "logs enable/disable",
          description: "Enable or disable specific log categories.",
          usage:
            "/logs enable category:<message|voice|server|bot|all>\n/logs disable category:<message|voice|server|bot|all>",
        },
        {
          name: "logs access",
          description: "Grant or revoke log channel access for a role.",
          usage: "/logs access role:<role> action:<grant|revoke>",
        },
        {
          name: "logs status",
          description: "View current logging configuration.",
          usage: "/logs status",
        },
        {
          name: "logs delete",
          description: "Delete all logging channels and disable logging.",
          usage: "/logs delete",
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
          name: "Music Wrapped & Stats",
          value: [
            "- `/wrapped me` shows your personal listening statistics: top tracks, top artists, listening patterns, and achievements.",
            "- `/wrapped server` displays server-wide music statistics: total playtime, top sources, peak activity hours.",
            "- `/stats` shows quick stats for the current server and global usage.",
            "- `/stats detailed:true` includes top sources breakdown and most active hour visualization.",
            "- All stats track automatically as you play music - no setup required!",
          ].join("\n"),
        },
        {
          name: "Health Monitoring (Admin)",
          value: [
            "- `/health status` provides an overview: overall health, active issues, quick metrics, and recent errors.",
            "- `/health metrics` shows detailed system info: memory usage, CPU, event loop lag, Lavalink status, command success rates.",
            "- `/health errors` displays recent error logs with timestamps and context (useful for troubleshooting).",
            "- `/health reset` clears all health metrics counters (does not affect music stats).",
            "- Health monitoring runs automatically and tracks errors, warnings, and performance metrics.",
          ].join("\n"),
        },
        {
          name: "Music Source Configuration",
          value: [
            "- `/setup source server` sets the server-wide default search source (Deezer, YouTube, or Spotify).",
            "- `/setup source me` sets your personal default source that overrides server default.",
            "- Use 'Use Server Default' option to clear your personal preference.",
            "- **Priority**: Per-query selection > Personal preference > Server default.",
            "- Users can always override by selecting a source in `/play` command.",
            "- `/setup source status` shows server default, your preference, and effective source.",
            "- Server defaults to Deezer (FLAC quality) if not configured.",
          ].join("\n"),
        },
        {
          name: "Server Logging System",
          value: [
            "- Use `/logs setup` to create a complete logging system for your server.",
            "- **Auto-creates**: Log category with 4 read-only channels (admins only by default).",
            "- **Message Logs**: Tracks message edits and deletions with content and author.",
            "- **Voice Logs**: Tracks joins, leaves, moves, mutes, deafens, streaming, and camera.",
            "- **Server Logs**: Tracks member joins/leaves, role changes, nickname changes, bans, and timeouts.",
            "- **Bot Logs**: Tracks all bot command usage with user, channel, and any errors.",
            "- Grant access to specific roles with `/logs access role:@Moderators action:grant`.",
            "- Enable/disable individual categories with `/logs enable` or `/logs disable`.",
          ].join("\n"),
        },
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
    moderation: {
      label: "Moderation",
      description: "Server moderation and management tools.",
      emoji: "🛡️",
      commands: [
        {
          name: "mod kick",
          description: "Kick a member from the server.",
          usage: "/mod kick user:<member> [reason:<text>]",
        },
        {
          name: "mod ban",
          description: "Ban a member from the server. Optionally delete their message history.",
          usage: "/mod ban user:<member> [reason:<text>] [delete-messages:<0-7 days>]",
        },
        {
          name: "mod unban",
          description: "Unban a previously banned user. Autocomplete shows banned users.",
          usage: "/mod unban user-id:<id> [reason:<text>]",
        },
        {
          name: "mod timeout",
          description: "Timeout (mute) a member for a specified duration.",
          usage: "/mod timeout user:<member> duration:<time> [reason:<text>]",
        },
        {
          name: "mod untimeout",
          description: "Remove timeout from a member.",
          usage: "/mod untimeout user:<member> [reason:<text>]",
        },
        {
          name: "mod purge",
          description: "Bulk delete messages. Optionally filter by user.",
          usage: "/mod purge amount:<1-100> [user:<member>]",
        },
        {
          name: "mod slowmode",
          description: "Set channel slowmode (rate limit).",
          usage: "/mod slowmode seconds:<0-21600>",
        },
        {
          name: "mod lock",
          description: "Lock a channel to prevent members from sending messages.",
          usage: "/mod lock [reason:<text>]",
        },
        {
          name: "mod unlock",
          description: "Unlock a previously locked channel.",
          usage: "/mod unlock [reason:<text>]",
        },
        {
          name: "mod warn",
          description: "Send a warning to a user via DM.",
          usage: "/mod warn user:<member> reason:<text>",
        },
        {
          name: "embed",
          description: "Send a custom embedded message to any channel. Opens a modal for title/description input.",
          usage: "/embed channel:<channel> [color:<preset>] [image:<url>] [thumbnail:<url>] [timestamp:<true|false>]",
        },
      ],
      notes: [
        {
          name: "Moderation Permissions",
          value: [
            "- All `/mod` commands require **Moderate Members** permission.",
            "- `/embed` requires **Manage Messages** permission.",
            "- Bot must have higher role than target users for kick/ban/timeout.",
            "- Purge can only delete messages from the last 14 days (Discord limitation).",
          ].join("\n"),
        },
        {
          name: "Custom Embeds",
          value: [
            "- Use `/embed` to send announcements, rules, or formatted messages.",
            "- Supports title, description, footer, author, images, and timestamps.",
            "- 8 preset colors available (Blurple, Green, Red, Yellow, etc.).",
            "- Description supports full Discord markdown formatting.",
          ].join("\n"),
        },
      ],
    },
    tickets: {
      label: "Tickets & Feedback",
      description: "Bug reports, feature requests, and feedback system.",
      emoji: "🎫",
      commands: [
        {
          name: "ticket create",
          description: "Create a new ticket: bug report, feature request, feedback, question, or other.",
          usage: "/ticket create type:<bug|feature|feedback|question|other>",
        },
        {
          name: "ticket list",
          description: "View all your submitted tickets in this server.",
          usage: "/ticket list",
        },
        {
          name: "ticket view",
          description: "View details of a specific ticket. Autocomplete shows your tickets.",
          usage: "/ticket view id:<ticket-id>",
        },
        {
          name: "ticket admin setup",
          description: "Configure the ticket system: set notification channel and optional ping role.",
          usage: "/ticket admin setup channel:<channel> [role:<role>]",
        },
        {
          name: "ticket admin disable",
          description: "Disable the ticket system for this server.",
          usage: "/ticket admin disable",
        },
        {
          name: "ticket admin pending",
          description: "View all tickets for this server. Filter by status.",
          usage: "/ticket admin pending [status:<open|in-progress|closed|all>]",
        },
        {
          name: "ticket admin respond",
          description: "Send a response to a ticket. User will be notified via DM.",
          usage: "/ticket admin respond id:<ticket-id>",
        },
        {
          name: "ticket admin close",
          description: "Close a ticket with an optional reason.",
          usage: "/ticket admin close id:<ticket-id> [reason:<text>]",
        },
      ],
      notes: [
        {
          name: "For Users",
          value: [
            "- Use `/ticket create` to report bugs, request features, or provide feedback.",
            "- You'll receive DM notifications when staff responds to or closes your ticket.",
            "- Track your tickets with `/ticket list` and `/ticket view`.",
            "- Each ticket gets a unique 6-character ID for easy reference.",
          ].join("\n"),
        },
        {
          name: "For Admins",
          value: [
            "- Set up with `/ticket admin setup` to receive notifications in a channel.",
            "- Optionally set a role to ping when new tickets arrive.",
            "- Use quick-action buttons on notifications: Mark In Progress, Respond, Close.",
            "- Admin commands require **Manage Server** permission.",
          ].join("\n"),
        },
        {
          name: "Ticket Types",
          value: [
            "🐛 **Bug Report** - Something isn't working correctly",
            "💡 **Feature Request** - Suggest new functionality",
            "💬 **General Feedback** - Share thoughts and experiences",
            "❓ **Question** - Ask about bot features or usage",
            "📝 **Other** - Anything else",
          ].join("\n"),
        },
      ],
    },
  },
};
