module.exports = {
  DEFAULT_CATEGORY: 'playback',
  CATEGORIES: {
    playback: {
      label: 'Playback Control',
      description: 'Start playback, manage the current track, and view lyrics.',
      emoji: '🎶',
      commands: [
        {
          name: 'play',
          description: 'Queue a track from a URL or search query. In DJ mode, non-DJs submit suggestions for approval.',
          usage: '/play query:<song or url> [prepend:true]',
        },
        {
          name: 'pause',
          description: 'Pause the currently playing track (DJ/strict permissions apply).',
          usage: '/pause',
        },
        {
          name: 'resume',
          description: 'Resume a paused track (DJ/strict permissions apply).',
          usage: '/resume',
        },
        {
          name: 'stop',
          description: 'Stop playback and clear the queue (DJ only while DJ mode is enabled).',
          usage: '/stop',
        },
        {
          name: 'skip',
          description: 'Skip the current track or trigger a vote depending on DJ mode configuration.',
          usage: '/skip',
        },
        {
          name: 'previous',
          description: 'Restart the current track or play the previous one (DJ restricted in DJ mode).',
          usage: '/previous',
        },
        {
          name: 'seekto',
          description: 'Jump to a specific timestamp in the current track (DJ restricted in DJ mode).',
          usage: '/seekto position:<seconds|mm:ss|hh:mm:ss>',
        },
        {
          name: 'volume',
          description: 'Set the playback volume between 0 and 100 (DJ only in DJ mode).',
          usage: '/volume level:<0-100>',
        },
        {
          name: 'lyrics',
          description: 'Display lyrics for the currently playing song.',
          usage: '/lyrics',
        },
      ],
    },
    queue: {
      label: 'Queue & Looping',
      description: 'Inspect and reorder what is coming up next.',
      emoji: '📜',
      commands: [
        {
          name: 'queue',
          description: 'Show the current queue with pagination controls. Pending DJ suggestions appear when DJ mode is active.',
          usage: '/queue',
        },
        {
          name: 'remove',
          description: 'Remove a specific track from the queue by position or title (DJ only in DJ mode).',
          usage: '/remove [position:<number>] [title:<keyword>]',
        },
        {
          name: 'clearqueue',
          description: 'Remove every track from the queue (DJ only while DJ mode is enabled).',
          usage: '/clearqueue',
        },
        {
          name: 'shuffle',
          description: 'Shuffle the order of the queued tracks (DJ restricted in DJ mode).',
          usage: '/shuffle',
        },
        {
          name: 'loop',
          description: 'Toggle loop mode for the current track or queue (DJ restricted in DJ mode).',
          usage: '/loop [mode:<NONE|TRACK|QUEUE>]',
        },
      ],
    },
    filters: {
      label: 'Equalizer & Effects',
      description: 'Tune the audio output with presets or per-band adjustments.',
      emoji: '🎚️',
      commands: [
        {
          name: 'eq preset',
          description: 'Apply a predefined equalizer preset (bass, nightcore, lofi, etc.).',
          usage: '/eq preset name:<preset>',
        },
        {
          name: 'eq set',
          description: 'Manually adjust a single EQ band gain.',
          usage: '/eq set band:<0-14> gain:<value>',
        },
        {
          name: 'eq reset',
          description: 'Reset the equalizer back to a flat response.',
          usage: '/eq reset',
        },
      ],
    },
    utility: {
      label: 'Utility',
      description: 'Stats, diagnostics, and DJ mode management.',
      emoji: '🛠️',
      commands: [
        {
          name: 'stats',
          description: 'Show per-guild and global playback statistics.',
          usage: '/stats',
        },
        {
          name: 'user',
          description: 'Inspect a user’s profile, flags, and status.',
          usage: '/user user:<member>',
        },
        {
          name: 'dj',
          description: 'Configure DJ mode: enable/disable, assign the DJ role, toggle strict permissions, and adjust skip voting.',
          usage: '\n/dj enable role:<role> [skipmode:<mode>] [threshold:<10-100>]\n/dj disable\n/dj setrole role:<role>\n/dj skipmode mode:<mode> [threshold:<10-100>]\n/dj permissions strict:<true|false>\n/dj status',
        },
        {
          name: 'help',
          description: 'Open the interactive help menu.',
          usage: '/help',
        },
      ],
      notes: [
        {
          name: 'DJ Mode Overview',
          value: [
            '- Enable DJ mode with `/dj enable`. Supply an existing role or leave it blank to have the bot create **DJ** automatically.',
            '- When DJ mode is on, only the DJ role controls playback/queue actions; everyone else submits `/play` suggestions for approval.',
            '- `/dj skipmode` chooses how skip requests behave: `dj` (DJ decides), `vote` (threshold-based votes), or `hybrid` (vote first, DJ fallback).',
            '- `/dj permissions strict:true` locks DJ management to the DJ role; `false` lets server managers help.',
            '- `/dj status` shows the current role, skip mode, vote threshold, and strict mode state.',
          ].join('\n'),
        },
      ],
    },
  },
};
