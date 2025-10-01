module.exports = {
  DEFAULT_CATEGORY: 'playback',
  CATEGORIES: {
    playback: {
      label: 'Playback Control',
      description: 'Start playback, manage the current track, and pull up lyrics.',
      emoji: '🎶',
      commands: [
        {
          name: 'play',
          description: 'Queue a track from a URL or search query.',
          usage: '/play query:<song or url> [prepend:true]',
        },
        {
          name: 'pause',
          description: 'Pause the currently playing track.',
          usage: '/pause',
        },
        {
          name: 'resume',
          description: 'Resume a paused track.',
          usage: '/resume',
        },
        {
          name: 'stop',
          description: 'Stop playback and clear the queue.',
          usage: '/stop',
        },
        {
          name: 'skip',
          description: 'Skip the current track or remove a queued song.',
          usage: '/skip [position:<number> | title:<keyword>]',
        },
        {
          name: 'previous',
          description: 'Restart the current track or play the previous one.',
          usage: '/previous',
        },
        {
          name: 'seekto',
          description: 'Jump to a specific timestamp in the current track.',
          usage: '/seekto position:<seconds|mm:ss|hh:mm:ss>',
        },
        {
          name: 'volume',
          description: 'Set the playback volume between 0 and 100.',
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
          description: 'Show the current queue with pagination controls.',
          usage: '/queue',
        },
        {
          name: 'clearqueue',
          description: 'Remove every track from the queue.',
          usage: '/clearqueue',
        },
        {
          name: 'shuffle',
          description: 'Shuffle the order of the queued tracks.',
          usage: '/shuffle',
        },
        {
          name: 'loop',
          description: 'Toggle loop mode for the current track or queue.',
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
      description: 'Stats, diagnostics, and miscellaneous helpers.',
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
          name: 'help',
          description: 'Open the interactive help menu.',
          usage: '/help',
        },
      ],
    },
  },
};
