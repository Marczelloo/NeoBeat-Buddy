## FUNCTIONALITIES
- [x] play age restricted songs
- [x] fix issue when playing age restricted songs and one fails then some songs are skipped 
- [x] disconnecting after inactivity (when nothing is playing and queue is empty)
- [x] fix displaying queue, always does not show what is currently playing
- [x] fix check for user to be in voice channel to be in the same as bot
- [x] update player after using commands and not buttons
- [x] seek, shuffle, loop (shuffle and loop functionality already in buttons) command
- [-] fix adding youtube mix playlists, only first song is accurate from list (cant fix this cause how youtube api works and how lavalink reads these playlists)
- [x] clearQueue command
- [x] volume command
- [] autoplay (automatically searches for next song based on current one)
- [] 24/7 command
- [] live equalizer
- [] lyrics for current song (if possible make them synced with song)
- [x] progress of song
- [] add more sources for play command (current: youtube, spotify | planned: apple music, soundcloud, tidal, dreezer(for FLACS) )
- [] create docker file and compose lavalink and bot
- [] create help command with descriptions and select form for additional info (possibly per categories or usage of specific command)
- [] other commands
- [] create readme file 

## OTHER
- [] add more logging
- [] move components/function to helpers folder/modules
- [] cleanup code
- [] create website for bot 

## IDEAS
- [] Cross-guild playlist sharing: let users export/import queues and playlists across servers so the community can share curated sets.
- [] Smart DJ mode: analyze listening history to auto-mix genres, adjust transitions, or surface “mood” suggestions when the queue runs low.
- [] Per-user audio profiles: remember preferred volume/filters per user and automatically apply when they join.
- [] Queue voting + skip threshold tuning: allow members to up/down vote songs and dynamically adjust skip requirements based on active listeners.
- [] Listening parties with synced lyrics/cards: schedule sessions that show upcoming tracks, synced trivia, or karaoke-friendly overlays in a companion channel.
- [] Adaptive queue sorting: let listeners sort by requester, duration, popularity, or sentiment so long queues stay manageable.
- [] Audio reaction filters: trigger temporary effects (bass boost, vocal isolate, reverb) from button taps that sync to the track for a few seconds.
- [] Collaborative DJ roles: assign rotating “DJ for the hour” roles with permissions to curate or pin queue slots, with automated reminders when it’s someone’s turn.
- [] * History recall + requeue: expose a searchable history browser (per server) to quickly replay a track or generate a “top hits” set from past sessions.
- [] Voice activity-triggered tips: when a lull hits, have the bot surface suggested commands (“try /radio jazz”) or poll the channel for next genre.