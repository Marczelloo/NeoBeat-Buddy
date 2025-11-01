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
- [x] add to play command songs autocompleted based on user query
- [x] server playlists, user playlists (with sharing, collaboration, liked songs, autocomplete)
- [x] Mixer Panel Concept (Fully implemented with 15-band control, A/B toggle, custom presets)
- [x] volume normalization (automatic on player creation, balances YouTube/Spotify/SoundCloud levels)
- [x] improved autocomplete with Spotify + YouTube merged results (better metadata, no duplicates)
- [x] source display in player and queue embeds
- [ ] investigate Deezer FLAC direct playback (currently only works for autoplay recommendations, not direct playback)
- [ ] save queue (all songs played in current session) as playlist, queue import / export
- [ ] search history
- [ ] stats enchancment / listening wrapped
- [ ] better logging + health monitoring

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
- [x] fix seekto formatting
- [x] fix previous button not refreshing player embed
- [x] check if its possible to normalize volume (some songs are louder/quieter)

## OTHER

- [x] clean lavalinkManager and move helpers to other files !!!!
- [x] (lavalink | rest of the files to be checked) move components/function to helpers folder/modules
- [x] create docker file and compose lavalink and bot
- [x] remove global.js since lavalink poru/lavalink maintain most of these functions and migrate the needed ones
- [x] cleanup help command and sepperate it into smaller chunks
- [] add more logging and improve track logs
- [] cleanup code, refactor, switch to ts, add db integration for storing data
- [] create website for bot

## IDEAS

# 1. Music Quiz/Trivia Game

One of Master-Bot's most popular features - plays songs and users guess the title/artist

/quiz start [category] [difficulty] [rounds] - Start music trivia
Plays 10-30 second clips, users race to guess
Leaderboard tracking, points, streaks
Categories: decade, genre, artist, your listening history
Why it's popular: Gamification + social competition

# 2. Radio Stations

/radio <genre/station> - Start a curated radio stream
Pre-built stations: lofi, jazz, rock, EDM, chill, study beats
Could use your autoplay algorithm to create custom stations
Why it's popular: Zero-effort music discovery

# 3. Filters/Effects (Beyond EQ)

You have EQ, but most bots also offer:

Nightcore (speed up + pitch up)
Vaporwave (slow down + pitch down)
8D Audio (panning effect)
Karaoke (vocal removal)
Tremolo, Vibrato, Distortion
Lavalink supports these via filters!

# 4. Queue Position Swapping

/queue move <from> <to> - You have this!
/queue swap <pos1> <pos2> - Swap two positions
Drag-and-drop if you build a web dashboard

# 5. Track History Browser

/history [user] - See last 50 tracks played
/replay <number> - Replay track from history
/history search <query> - Find that song you heard 2 hours ago
Export history to playlist

# 6. Soundboard/Sound Effects

/soundboard <effect> - Play short sound clips
Air horn, applause, drumroll, meme sounds
Custom sounds per server
Why it's popular: Fun, memes, community bonding

# 7. Music Discovery Features

/discover - Get personalized recommendations based on your stats
/trending - Most played tracks in your server this week
/similar <track> - Find similar songs
/new - Recently added/released tracks

# 8. Web Dashboard

Many popular bots have web interfaces:

Browse queue with drag-and-drop
Visual EQ mixer
Playlist management
Server stats/analytics
Remote control from browser
