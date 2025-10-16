## FUNCTIONALITIES

- [x] play age restricted songs
- [x] disconnecting after inactivity (when nothing is playing and queue is empty)
- [x] update player after using commands and not buttons
- [x] seek, shuffle, loop (shuffle and loop functionality already in buttons) command
- [x] clearQueue command
- [x] volume command
- [x] true previous button functionality and command
- [x] live equalizer
- [x] lyrics for current song (if possible make them synced with song | not possible - most of the time out of sync)
- [x] improve info when adding playlist to queue (embed with playlist name and number of songs etc.)
- [x] possibility to remove selected song from queue (by id or title )
- [x] improve messages when track is age restricted and will be queued with fallback (now shows 2 messages)
- [x] progress of song
- [x] create help command with descriptions and select form for additional info (possibly per categories or usage of specific command | update it with new commands)
- [x] create readme file (update it later with bot implementation)
- [x] add button to player for lyrics
- [x] add button for volume (display modal window with text input for new volume)
- [x] add play override queue (instead adding song at the end of the queue it will place it at the start)
- [x] add dj role, only users with dj role can add songs to queue, use player, handle queue etc.
- [x] stats tracking per guild and globa (hours played, songs played etc.)
- [x] autoplay (automatically searches for next song based on current one)
- [x] adjust autoplay to count track history for better picking better song, include suggestions from spotify
- [x] enhance autoplay with tempo matching, time-of-day awareness, popularity weighting, mood progression, and energy arc management
- [x] 24/7 command
- [x] version announcements with patch notes system (/changelog command, auto-announce on updates, configurable via /setup announcements)
- [ ] server playlists, user playlists
- [ ] add more sources for play command (current: youtube, spotify | planned: apple music, soundcloud, tidal, dreezer(for FLACS) )
- [ ] other commands

## FIXES

- [x] fix issue when playing age restricted songs and one fails then some songs are skipped
- [-] fix adding youtube mix playlists, only first song is accurate from list (cant fix this cause how youtube api works and how lavalink reads these playlists)
- [x] fix displaying queue, always does not show what is currently playing
- [x] fix check for user to be in voice channel to be in the same as bot
- [x] fix issue when queue is empty (last song from queue stops playing) and u want to play song its only added to the queue but its not starting playing (confirmed issue)
- [x] fix after using stop command and playing somethign there are sent two players in message channel
- [x] fix seekTo command (when song duration in 2:57 and i seek to 2:30 track ends and plays next one from queue)
- [x] fix fallback query when there is no queue (add to queue but since there arent any songs it will try to play it on another /play command)
- [x] fix requester info after adding playlist (displays unknown)
- [x] fix double player message on pi after adding one song to queue and it stopping playing and then adding another song to queue
- [x] fix lyrics check if found are for proper song (not offical songs without posted lyrics have lyrics from different songs) | switched to genius api instead of lavalinks
- [x] review all changes and check what can be moved to modules, reused etc.
- [x] fix server sessions and avg sessions playtime
- [x] fix autoplay after some while starts playing the same 2 tracks in loop
- [x] upgrade autoplay algorithm to match for better songs (genre consistency + advanced scoring)
- [x] fix eqpanel message so it wont be lost somewhere in chat (closing panel / refreshing its position after using command)
- [x] fix BigInt serialization errors in equalizer and custom presets
- [x] fix duplicate tracks playing in autoplay (enhanced from 20 to 100 track memory + dual-layer detection)
- [x] fix fallback source playing tracks twice (removed manual play() call)
- [x] fix bot stopping after voice channel region change (automatic reconnection)

## OTHER

- [x] clean lavalinkManager and move helpers to other files !!!!
- [x] (lavalink | rest of the files to be checked) move components/function to helpers folder/modules
- [x] create docker file and compose lavalink and bot
- [x] remove global.js since lavalink poru/lavalink maintain most of these functions and migrate the needed ones
- [] add more logging and improve track logs
- [x] cleanup help command and sepperate it into smaller chunks
- [] cleanup code
- [] create website for bot

## IDEAS

- [ ] Cross-guild playlist sharing: let users export/import queues and playlists across servers so the community can share curated sets.
- [ ] Smart DJ mode: analyze listening history to auto-mix genres, adjust transitions, or surface "mood" suggestions when the queue runs low.
- [ ] Per-user audio profiles: remember preferred volume/filters per user and automatically apply when they join.
- [ ] Queue voting + skip threshold tuning: allow members to up/down vote songs and dynamically adjust skip requirements based on active listeners.
- [ ] Listening parties with synced lyrics/cards: schedule sessions that show upcoming tracks, synced trivia, or karaoke-friendly overlays in a companion channel.
- [ ] Adaptive queue sorting: let listeners sort by requester, duration, popularity, or sentiment so long queues stay manageable.
- [ ] Audio reaction filters: trigger temporary effects (bass boost, vocal isolate, reverb) from button taps that sync to the track for a few seconds.
- [ ] Collaborative DJ roles: assign rotating "DJ for the hour" roles with permissions to curate or pin queue slots, with automated reminders when it's someone's turn.
- [ ] \* History recall + requeue: expose a searchable history browser (per server) to quickly replay a track or generate a "top hits" set from past sessions.
- [ ] Voice activity-triggered tips: when a lull hits, have the bot surface suggested commands ("try /radio jazz") or poll the channel for next genre.

- [x] Mixer Panel Concept (Fully implemented with 15-band control, A/B toggle, custom presets)
