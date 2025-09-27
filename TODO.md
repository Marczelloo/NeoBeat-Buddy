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
- [] autoplay (automatically searches for next song based on current one)
- [] possibility to remove selected song from queue (by id or title )
- [] add dj role, only users with dj role can add songs to queue, use player, handle queue etc.
- [] 24/7 command
- [x] progress of song
- [] add more sources for play command (current: youtube, spotify | planned: apple music, soundcloud, tidal, dreezer(for FLACS) )
- [] create help command with descriptions and select form for additional info (possibly per categories or usage of specific command)
- [] other commands
- [x] create readme file (update it later with bot implementation)

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
- [] fix double player message on pi after adding one song to queue and it stopping playing and then adding another song to queue
▌INFO         27.09.2025 01:36:07.996 █ - █ guild=857906909930455070 █ track=Zwariowana noc [1G2Mvdoy6VqE1szk91yfFS] █ reason={
  op: 'event',                                                                                                                                                                                     
  type: 'TrackEndEvent',                                                                                                                                                                           
  guildId: '857906909930455070',                                                                                                                                                                   
  track: {                                                                                                                                                                                         
    encoded: 'QAABWQMADlp3YXJpb3dhbmEgbm9jAAV2YXNlcgAAAAAAAfIPABYxRzJNdmRveTZWcUUxc3prOTF5ZkZTAAEANWh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS90cmFjay8xRzJNdmRveTZWcUUxc3prOTF5ZkZTAQBAaHR0cHM6Ly9pLnNjZG4uY28vaW1hZ2UvYWI2NzYxNmQwMDAwYjI3M2YxODY2MTUyMDBkMDI4OGVlYTA4Yzc4YQEADFBMQzA2MjM4NTAzNgAHc3BvdGlmeQEADlp3YXJpb3dhbmEgbm9jAQA1aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tL2FsYnVtLzB5akFJd1h5NjhIOTJJakpMOUI1NDEBADZodHRwczovL29wZW4uc3BvdGlmeS5jb20vYXJ0aXN0LzN4YXFCZUd2TXRMNHFBQnJnUnBKdzIAAAAAAAAAAAAAAA==',                                                                                                     
    info: [Object],                                                                                                                                                                                
    pluginInfo: [Object],                                                                                                                                                                          
    userData: {}                                                                                                                                                                                   
  },                                                                                                                                                                                               
  reason: 'finished'                                                                                                                                                                               
} █ queueLength=539 █ next=Zwariowana noc [1G2Mvdoy6VqE1szk91yfFS]      Lavalink track ended
 ▌ERROR        27.09.2025 01:36:08.010 █ - █ guild=857906909930455070 █ track=Szonlover [5cQrcDeXnXmJVLrM1fqJxv] █ queueLength=538 █ error={
  op: 'event',                                                                                                                                                                                     
  type: 'TrackExceptionEvent',                                                                                                                                                                     
  guildId: '857906909930455070',                                                                                                                                                                   
  track: {                                                                                                                                                                                         
    encoded: 'QAABWQMADlp3YXJpb3dhbmEgbm9jAAV2YXNlcgAAAAAAAfIPABYxRzJNdmRveTZWcUUxc3prOTF5ZkZTAAEANWh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS90cmFjay8xRzJNdmRveTZWcUUxc3prOTF5ZkZTAQBAaHR0cHM6Ly9pLnNjZG4uY28vaW1hZ2UvYWI2NzYxNmQwMDAwYjI3M2YxODY2MTUyMDBkMDI4OGVlYTA4Yzc4YQEADFBMQzA2MjM4NTAzNgAHc3BvdGlmeQEADlp3YXJpb3dhbmEgbm9jAQA1aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tL2FsYnVtLzB5akFJd1h5NjhIOTJJakpMOUI1NDEBADZodHRwczovL29wZW4uc3BvdGlmeS5jb20vYXJ0aXN0LzN4YXFCZUd2TXRMNHFBQnJnUnBKdzIAAAAAAAAAAAAAAA==',                                                                                                     
    info: [Object],                                                                                                                                                                                
    pluginInfo: [Object],                                                                                                                                                                          
    userData: {}                                                                                                                                                                                   
  },                                                                                                                                                                                               
  exception: {                                                                                                                                                                                     
    message: 'No mirror found for track',                                                                                                                                                          
    severity: 'common',                                                                                                                                                                            
    cause: 'com.github.topi314.lavasrc.mirror.TrackNotFoundException: No mirror found for track',                                                                                                  
    causeStackTrace: 'com.github.topi314.lavasrc.mirror.TrackNotFoundException: No mirror found for track\n' +                                                                                     
      '\tat com.github.topi314.lavasrc.mirror.MirroringAudioTrack.process(MirroringAudioTrack.java:59)\n' +                                                                                        
      '\tat com.sedmelluq.discord.lavaplayer.track.playback.LocalAudioTrackExecutor.execute(LocalAudioTrackExecutor.java:109)\n' +                                                                 
      '\tat com.sedmelluq.discord.lavaplayer.player.DefaultAudioPlayerManager.lambda$executeTrack$2(DefaultAudioPlayerManager.java:339)\n' +                                                       
      '\tat java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(Unknown Source)\n' +                                                                                                       
      '\tat java.base/java.util.concurrent.ThreadPoolExecutor$Worker.run(Unknown Source)\n' +                                                                                                      
      '\tat java.base/java.lang.Thread.run(Unknown Source)\n'                                                                                                                                      
  }                                                                                                                                                                                                
}      Lavalink track error
 ▌ERROR        27.09.2025 01:36:08.013 █ - █ guild=857906909930455070 █ track=Szonlover [5cQrcDeXnXmJVLrM1fqJxv] █ queueLength=538 █ error={
  op: 'event',                                                                                                                                                                                     
  type: 'TrackExceptionEvent',                                                                                                                                                                     
  guildId: '857906909930455070',                                                                                                                                                                   
  track: {                                                                                                                                                                                         
    encoded: 'QAABWQMADlp3YXJpb3dhbmEgbm9jAAV2YXNlcgAAAAAAAfIPABYxRzJNdmRveTZWcUUxc3prOTF5ZkZTAAEANWh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS90cmFjay8xRzJNdmRveTZWcUUxc3prOTF5ZkZTAQBAaHR0cHM6Ly9pLnNjZG4uY28vaW1hZ2UvYWI2NzYxNmQwMDAwYjI3M2YxODY2MTUyMDBkMDI4OGVlYTA4Yzc4YQEADFBMQzA2MjM4NTAzNgAHc3BvdGlmeQEADlp3YXJpb3dhbmEgbm9jAQA1aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tL2FsYnVtLzB5akFJd1h5NjhIOTJJakpMOUI1NDEBADZodHRwczovL29wZW4uc3BvdGlmeS5jb20vYXJ0aXN0LzN4YXFCZUd2TXRMNHFBQnJnUnBKdzIAAAAAAAAAAAAAAA==',                                                                                                     
    info: [Object],                                                                                                                                                                                
    pluginInfo: [Object],                                                                                                                                                                          
    userData: {}                                                                                                                                                                                   
  },                                                                                                                                                                                               
  exception: {                                                                                                                                                                                     
    message: 'No mirror found for track',                                                                                                                                                          
    severity: 'common',                                                                                                                                                                            
    cause: 'com.github.topi314.lavasrc.mirror.TrackNotFoundException: No mirror found for track',                                                                                                  
    causeStackTrace: 'com.github.topi314.lavasrc.mirror.TrackNotFoundException: No mirror found for track\n' +                                                                                     
      '\tat com.github.topi314.lavasrc.mirror.MirroringAudioTrack.process(MirroringAudioTrack.java:59)\n' +                                                                                        
      '\tat com.sedmelluq.discord.lavaplayer.track.playback.LocalAudioTrackExecutor.execute(LocalAudioTrackExecutor.java:109)\n' +                                                                 
      '\tat com.sedmelluq.discord.lavaplayer.player.DefaultAudioPlayerManager.lambda$executeTrack$2(DefaultAudioPlayerManager.java:339)\n' +                                                       
      '\tat java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(Unknown Source)\n' +                                                                                                       
      '\tat java.base/java.util.concurrent.ThreadPoolExecutor$Worker.run(Unknown Source)\n' +                                                                                                      
      '\tat java.base/java.lang.Thread.run(Unknown Source)\n'                                                                                                                                      
  }                                                                                                                                                                                                
}      Lavalink track error
 ▌INFO         27.09.2025 01:36:08.015 █ - █ guild=857906909930455070 █ track=Szonlover [5cQrcDeXnXmJVLrM1fqJxv] █ queueLength=538      Lavalink track started
 ▌INFO         27.09.2025 01:36:08.020 █ - █ guild=857906909930455070 █ track=Szonlover [5cQrcDeXnXmJVLrM1fqJxv] █ reason={
  op: 'event',                                                                                                                                                                                     
  type: 'TrackEndEvent',                                                                                                                                                                           
  guildId: '857906909930455070',                                                                                                                                                                   
  track: {                                                                                                                                                                                         
    encoded: 'QAABWgMACVN6b25sb3ZlcgAQUC5JLldPIEJPWVogR0FORwAAAAAAA7DhABY1Y1FyY0RlWG5YbUpWTHJNMWZxSnh2AAEANWh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS90cmFjay81Y1FyY0RlWG5YbUpWTHJNMWZxSnh2AQBAaHR0cHM6Ly9pLnNjZG4uY28vaW1hZ2UvYWI2NzYxNmQwMDAwYjI3MzBlN2Y1MzFkYmM3NGVjMzczODJlOGM5ZQEADFFaRVM2MjE4MDY4NQAHc3BvdGlmeQEACVN6b25sb3ZlcgEANWh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS9hbGJ1bS8xN09MMWJYNjFaS1phTnhTa3ZFZmdaAQA2aHR0cHM6Ly9vcGVuLnNwb3RpZnkuY29tL2FydGlzdC80MTNXVTJlb2w2eFBqZ2lnR1g1ZWU4AAAAAAAAAAAAAAA=',                                                                                                     
    info: [Object],                                                                                                                                                                                
    pluginInfo: [Object],                                                                                                                                                                          
    userData: {}                                                                                                                                                                                   
  },                                                                                                                                                                                               
  reason: 'stopped'                                                                                                                                                                                
} █ queueLength=538 █ next=Szonlover [5cQrcDeXnXmJVLrM1fqJxv]      Lavalink track ended
 ▌INFO         27.09.2025 01:36:08.025 █ - █ guild=857906909930455070 █ track=SIĘ WJEŻDŻA [2yEWVnp65tTXSrRW03IqXs] █ queueLength=537      Lavalink track started
 ▌ERROR        27.09.2025 01:36:08.228 █ -      Failed to disable buttons on track end DiscordAPIError[10008]: Unknown Message
 ▌ERROR        27.09.2025 01:36:08.249 █ -      Failed to delete old now playing message DiscordAPIError[10008]: Unknown Message
 ▌INFO         27.09.2025 01:36:08.377 █ - █ guild=857906909930455070 █ from=Szonlover [5cQrcDeXnXmJVLrM1fqJxv] █ to=Szonlover [-TFNO4andzU] █ source=ytmsearch      Queued fallback track
 ▌ERROR        27.09.2025 01:36:08.446 █ -      Failed to delete old now playing message DiscordAPIError[10008]: Unknown Message
 ▌WARNING      27.09.2025 01:36:08.486 █ - █ guild=857906909930455070 █ queueLength=538      Waiting for Lavalink auto-skip after error
 ▌ERROR        27.09.2025 01:36:13.212 █ -      Failed to disable buttons on track end DiscordAPIError[10008]: Unknown Message
- [] fix after changing channel region bot freezes and is not playing anything, not throwing error any, responding to commands but not doing anything related to playing

## OTHER
- [x] clean lavalinkManager and move helpers to other files !!!!
- [x] (lavalink | rest of the files to be checked) move components/function to helpers folder/modules
- [x] create docker file and compose lavalink and bot
- [x] remove global.js since lavalink poru/lavalink maintain most of these functions and migrate the needed ones 
- [] add more logging and improve track logs
- [] cleanup help command and sepperate it into smaller chunks
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