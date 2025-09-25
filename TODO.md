## FUNCTIONALITIES
- [x] play age restricted songs
- [x] disconnecting after inactivity (when nothing is playing and queue is empty)
- [x] update player after using commands and not buttons
- [x] seek, shuffle, loop (shuffle and loop functionality already in buttons) command
- [x] clearQueue command
- [x] volume command
- [x] true previous button functionality and command
- [x] live equalizer
- [] lyrics for current song (if possible make them synced with song)
- [] autoplay (automatically searches for next song based on current one)
- [] 24/7 command
- [x] progress of song
- [] add more sources for play command (current: youtube, spotify | planned: apple music, soundcloud, tidal, dreezer(for FLACS) )
- [] create help command with descriptions and select form for additional info (possibly per categories or usage of specific command)
- [] other commands
- [] create readme file 

## FIXES
- [x] fix issue when playing age restricted songs and one fails then some songs are skipped 
- [-] fix adding youtube mix playlists, only first song is accurate from list (cant fix this cause how youtube api works and how lavalink reads these playlists)
- [x] fix displaying queue, always does not show what is currently playing
- [x] fix check for user to be in voice channel to be in the same as bot
- [x] fix issue when queue is empty (last song from queue stops playing) and u want to play song its only added to the queue but its not starting playing (confirmed issue)
- [x] fix after using stop command and playing somethign there are sent two players in message channel
- [x] fix seekTo command (when song duration in 2:57 and i seek to 2:30 track ends and plays next one from queue)
- [] fix fallback query when there is no queue (add to queue but since there arent any songs it will try to play it on another /play command)

## OTHER
- [x] clean lavalinkManager and move helpers to other files !!!!
- [x] (lavalink | rest of the files to be checked) move components/function to helpers folder/modules
- [x] create docker file and compose lavalink and bot
- [x] remove global.js since lavalink poru/lavalink maintain most of these functions and migrate the needed ones 
- [] add more logging and improve track logs
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

- [] Mixer Panel Concept

Slash command /eqpanel (DJ only) posts/refreshes a persistent control message in the music text channel. Store panel state in a map keyed by guild (bands[15], page, savedSnapshot, abToggle, lastInteractionUserId, etc.).
Embed layout: title with current preset name, footer with “Page 1/3 • 60Hz–1kHz”, and a field rendering live band values (▁▂▃▄▅▆▇ scaled from ‑0.25 to +1 or a formatted +1.5 dB). Pull the numbers from your equalizerState map so it stays in sync with node updates.
Component rows:
StringSelectMenu for presets (flat, pop, edm, rock, vocal, bass, podcast). On select → call lavalinkSetEqualizer with the preset bands and refresh the embed.
Pager row: ⬅️ / ➡️ buttons with custom IDs eq:page:prev/eq:page:next. Switching pages just changes which five bands are displayed and which index the “nudge” buttons target.
Gain controls: – / + buttons for ±1 dB (≈0.125 gain). If interaction.customId signals shift (eq:nudge:+:shift), use ±0.5 dB. Clamp, call setEqualizer, refresh.
Utility row: A/B toggle button (swap between current bands and the saved snapshot), Reset button (lavalinkResetFilters), Save button (copy current bands into snapshot map).
Modal button Fine Tune (eq:modal). On click, show a modal with a TextInput for comma-separated gains (15 values). Parse → validate → call setEqualizer.
Interaction guardrails: reject if the user isn’t in the source voice channel, if they lack the DJ role, or if they’re not the “session owner” unless you want shared control.
Throttle updates: wrap lavalinkSetEqualizer calls with a debounced dispatcher per guild (e.g., delay 200 ms) to avoid spamming the node when users mash buttons.
Persistence: store messageId in state so later /eqpanel calls can edit the existing message instead of creating new ones. On player destroy or reset, delete the state entry and disable the panel components.
Optional enhancement: if you already send a now-playing embed, include a compact EQ bar there by reading from the shared equalizerState.