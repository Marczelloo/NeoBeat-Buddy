# Testing Checklist for v1.0.10

**Version:** 1.0.10  
**Date:** 2025-11-03  
**Status:** ⚠️ UNTESTED - Requires comprehensive testing before deployment

## Overview

This version includes 4 major feature groups that need testing:

1. **Search History System** (5 commands)
2. **Queue Export** (session save to playlist)
3. **Music Wrapped & Stats** (personal + server insights)
4. **Health Monitoring & Enhanced Logging** (admin diagnostics)

---

## 🔍 1. Search History Testing

### Setup

- [x] Start fresh bot instance
- [x] Join voice channel
- [x] Verify `helpers/data/searchHistory.json` doesn't exist yet

### 1.1 Auto-Recording Tests

**Test Case:** Search history auto-saves on `/play`

- [x] Run `/play query:Marina Bubblegum Bitch`
- [x] Verify track plays successfully
- [x] Check `helpers/data/searchHistory.json` created
- [x] Verify entry contains:
  - [x] `query` field matches "Marina Bubblegum Bitch"
  - [x] `track` object has title, author, identifier, uri, length, sourceName
  - [x] `guildId` matches current server
  - [x] `timestamp` is valid ISO date
- [x] Play 4 more different songs
- [x] Verify history has 5 entries (newest last)

**Test Case:** Playlists don't record in history

- [x] Run `/play query:spotify playlist url`
- [x] Verify no new history entry created (playlists excluded)

**Test Case:** Maximum history limit (100 entries)

- [] Simulate 100+ searches (can mock in code or play 100 songs)
- [ ] Verify only last 100 entries kept (FIFO queue)

### 1.2 `/history view` Tests

**Test Case:** Basic view with pagination

- [x] Run `/history view`
- [x] Verify embed shows:
  - [x] Title: "🕒 Your Search History"
  - [x] Up to 15 entries (oldest first)
  - [x] Each entry: number, title, artist, duration, source, time ago
- [x] Verify "Next" button appears if >15 entries
- [x] Click "Next" button
- [x] Verify page 2 displays next 15 entries
- [x] Verify "Previous" button appears
- [x] Click "Previous" to return to page 1

**Test Case:** Server filtering

- [ ] Play songs in Server A
- [ ] Play songs in Server B
- [ ] In Server A, run `/history view server-only:true`
- [ ] Verify only Server A songs shown
- [ ] Run `/history view server-only:false`
- [ ] Verify both Server A and B songs shown

**Test Case:** Empty history

- [x] Fresh user (or clear history)
- [x] Run `/history view`
- [x] Verify message: "Your search history is empty!"

### 1.3 `/history replay` Tests

**Test Case:** Replay track from history

- [x] Run `/history view` to see list
- [x] Note a track number (e.g., #3)
- [x] Run `/history replay number:3`
- [x] Verify track queued/played successfully
- [x] Verify success message shows track title

**Test Case:** Prepend option

- [x] Have 3+ songs in queue
- [x] Run `/history replay number:1 prepend:true`
- [x] Verify track added to front of queue (plays next)
- [x] Run `/history replay number:2 prepend:false`
- [x] Verify track added to end of queue

**Test Case:** Invalid track number

- [x] Run `/history replay number:999`
- [x] Verify error: "Track not found at position 999"

**Test Case:** Voice channel checks

- [x] Leave voice channel
- [x] Run `/history replay number:1`
- [x] Verify error: "You need to be in a voice channel"

### 1.4 `/history search` Tests

**Test Case:** Search by title

- [x] Play: "Marina - Bubblegum Bitch", "MARINA - Primadonna", "Arctic Monkeys - Do I Wanna Know"
- [x] Run `/history search query:Marina`
- [x] Verify both Marina songs appear
- [x] Verify Arctic Monkeys does not appear

**Test Case:** Search by artist

- [x] Run `/history search query:Arctic Monkeys`
- [x] Verify "Do I Wanna Know" appears

**Test Case:** Case-insensitive search

- [x] Run `/history search query:MARINA`
- [x] Run `/history search query:marina`
- [x] Run `/history search query:MaRiNa`
- [x] Verify all return same results

**Test Case:** No results

- [x] Run `/history search query:NonexistentSong123`
- [x] Verify message: "No matching tracks found"

### 1.5 `/history export` Tests

**Test Case:** Export to playlist

- [x] Play 5 different songs
- [x] Run `/history export name:MyHistoryPlaylist`
- [x] Verify success message shows track count
- [x] Run `/playlist list`
- [x] Verify "MyHistoryPlaylist" exists
- [x] Run `/playlist play name:MyHistoryPlaylist`
- [x] Verify all 5 songs queue correctly

**Test Case:** Export with limit

- [x] Have 20 songs in history
- [x] Run `/history export name:Top10 limit:10`
- [x] Verify playlist has only 10 tracks (most recent)

**Test Case:** Server filtering in export

- [ ] Have songs from 2 servers in history
- [ ] In Server A, run `/history export name:ServerA server-only:true`
- [ ] Verify playlist contains only Server A songs

**Test Case:** Empty history export

- [x] Clear history
- [x] Run `/history export name:Empty`
- [x] Verify error: "Your history is empty"

### 1.6 `/history clear` Tests

**Test Case:** Clear all history

- [x] Have 10+ songs in history
- [x] Run `/history clear`
- [x] Confirm in modal
- [x] Verify success message
- [x] Run `/history view`
- [x] Verify empty history

**Test Case:** Clear server-only

- [ ] Have songs from Server A and Server B in history
- [ ] In Server A, run `/history clear server-only:true`
- [ ] Confirm in modal
- [ ] Verify Server A songs removed
- [ ] Run `/history view server-only:false`
- [ ] Verify Server B songs still exist

---

## 📦 2. Queue Export Testing

### 2.1 `/queue export` Tests

**Test Case:** Export active session

- [x] Join voice channel
- [x] Play 3 songs (let them finish)
- [x] Add 2 songs to queue
- [x] Currently playing 1 song
- [x] Run `/queue export name:MySession`
- [x] Verify success message shows:
  - [x] Total tracks (should be 6: 3 history + 1 current + 2 queue)
  - [x] Added count
  - [x] Skipped count (if any duplicates)
- [x] Run `/playlist play name:MySession`
- [x] Verify all 6 songs queue in correct order

**Test Case:** Export with empty queue

- [x] Play 1 song (let it finish)
- [x] Queue is now empty
- [x] Run `/queue export name:SingleTrack`
- [x] Verify playlist created with just the 1 track from history

**Test Case:** No session state

- [x] Fresh guild, never played music
- [x] Run `/queue export name:Empty`
- [x] Verify error: "No active playback session"

**Test Case:** Duplicate handling

- [x] Play same song 3 times
- [x] Run `/queue export name:Duplicates`
- [] Verify skipped count shows duplicates removed
- [ ] Verify playlist has song only once

---

## 🎁 3. Music Wrapped & Stats Testing

### 3.1 User Stats Auto-Tracking

**Test Case:** Stats accumulate automatically

- [ ] Fresh user
- [ ] Play 5 different songs from different artists
- [ ] Skip 1 song
- [ ] Check `helpers/data/stats.json`
- [ ] Verify user entry exists with:
  - [ ] `songsPlayed: 5`
  - [ ] `songsSkipped: 1`
  - [ ] `msPlayed` > 0
  - [ ] `topTracks` has 5 entries
  - [ ] `topArtists` has artist counts
  - [ ] `topSources` tracks sources
  - [ ] `hourlyActivity` has current hour
  - [ ] `dailyActivity` has today's date
  - [ ] `firstPlayedAt` and `lastPlayedAt` set

### 3.2 `/wrapped me` Tests

**Test Case:** Personal wrapped view

- [x] Play 20+ songs with variety of artists
- [x] Run `/wrapped me`
- [x] Verify embed shows:
  - [x] User's avatar thumbnail
  - [x] Total songs played
  - [x] Total listening time (hours and days)
  - [x] Average songs per day
  - [x] Activity level (e.g., "Regular User 🎵")
  - [x] Top 5 tracks with play counts
  - [x] Top 5 artists with song counts
  - [x] Most active hour
  - [x] Favorite source
  - [x] Current streak (if listened today/yesterday)
  - [x] Longest streak
  - [x] Footer with "Member since" and "Last active"

**Test Case:** Fresh user wrapped

- [x] New user (never played music)
- [x] Run `/wrapped me`
- [x] Verify message: "You haven't listened to any music yet!"

**Test Case:** View another user's wrapped

- [ ] Have User A play 10 songs
- [ ] User B runs `/wrapped me user:@UserA`
- [ ] Verify User A's stats displayed (not User B's)

### 3.3 `/wrapped server` Tests

**Test Case:** Server-wide wrapped

- [x] Have 2+ users play music
- [x] Run `/wrapped server`
- [x] Verify embed shows:
  - [x] Server icon thumbnail
  - [x] Total songs played
  - [x] Total playtime
  - [x] Total listening sessions
  - [x] Avg songs per session
  - [x] Unique listeners count
  - [x] Peak listeners count
  - [x] Songs skipped
  - [x] Playlists added
  - [x] Top 5 sources with percentages
  - [x] Most active hour
  - [x] Footer with "Music playing since"

**Test Case:** Fresh server

- [ ] New guild (no music played)
- [ ] Run `/wrapped server`
- [ ] Verify message: "No music has been played in this server yet!"

### 3.4 `/stats detailed:true` Tests

**Test Case:** Basic stats view

- [x] Run `/stats`
- [x] Verify shows guild + global stats (as before)

**Test Case:** Detailed stats view

- [x] Run `/stats detailed:true`
- [x] Verify additional fields appear:
  - [x] "📻 Top Sources" section with top 5 and percentages
  - [x] "⏰ Most Active Hour" section with hour and song count

### 3.5 Listening Streak Tests

**Test Case:** Current streak builds

- [ ] Play music today
- [ ] Verify `/wrapped me` shows "Current streak: 1 days"
- [ ] Tomorrow, play music again
- [ ] Verify "Current streak: 2 days"

**Test Case:** Streak breaks

- [ ] Have 3-day streak
- [ ] Skip 2 days (don't play music)
- [ ] Play music again
- [ ] Verify "Current streak: 1 days"
- [ ] Verify "Longest streak: 3 days" preserved

---

## 🏥 4. Health Monitoring Testing

### 4.1 Auto-Monitoring Tests

**Test Case:** Health monitoring starts on boot

- [x] Start bot
- [x] Check logs for "Health monitoring started"
- [x] Wait 30 seconds
- [x] Verify event loop lag measured (check metrics)

**Test Case:** Command tracking

- [x] Run 5 successful commands
- [x] Run 1 command that fails (e.g., invalid input)
- [x] Get metrics: verify `commands.total: 6`, `successful: 5`, `failed: 1`

**Test Case:** Track events recorded

- [x] Play 3 songs successfully
- [x] Play 1 song that fails to load
- [x] Skip 1 song
- [x] Get metrics: verify `tracks.played: 3`, `tracks.failed: 1`, `tracks.skipped: 1`

**Test Case:** Error recording

- [x] Trigger an error (e.g., invalid Lavalink command)
- [x] Verify error appears in health metrics
- [x] Verify error logged to `logs/logs.txt`

### 4.2 `/health status` Tests (Admin Only)

**Test Case:** Healthy status

- [x] Fresh bot with no issues
- [x] Run `/health status`
- [x] Verify:
  - [x] Overall status: "✅ Healthy"
  - [x] No issues listed
  - [x] Quick metrics shown (uptime, memory, Lavalink, commands)
  - [x] No recent errors section (if none)

**Test Case:** Issues detected

- [x] Trigger high memory usage (load many large files)
- [x] OR disconnect Lavalink
- [x] Run `/health status`
- [x] Verify:
  - [x] Overall status: "❌ Issues Detected"
  - [x] Issues listed (e.g., "Lavalink not connected")

**Test Case:** Non-admin user

- [x] Regular user (no admin permissions)
- [x] Run `/health status`
- [x] Verify error: "You need Administrator permission"

### 4.3 `/health metrics` Tests

**Test Case:** Detailed metrics view

- [x] Run `/health metrics`
- [x] Verify embed shows:
  - [x] **System** section: platform, Node version, uptime
  - [x] **Memory** section: heap used/total, RSS, system totals
  - [x] **CPU** section: usage %, cores, event loop lag
  - [x] **Lavalink** section: status, reconnects, latency
  - [x] **Commands** section: total, successful, failed, success rate %
  - [x] **Tracks** section: played, failed, skipped
  - [x] **Errors & Warnings** section: total counts, recent errors

### 4.4 `/health errors` Tests

**Test Case:** View recent errors

- [x] Trigger 3 different errors
- [x] Run `/health errors`
- [x] Verify shows last 5 errors (default)
- [x] Each error shows: timestamp, message, context

**Test Case:** Custom limit

- [x] Trigger 10 errors
- [x] Run `/health errors limit:3`
- [x] Verify shows only 3 most recent

**Test Case:** No errors

- [x] Fresh bot
- [x] Run `/health errors`
- [x] Verify message: "No errors recorded! 🎉"

### 4.5 `/health reset` Tests

**Test Case:** Reset metrics

- [x] Run 10 commands
- [x] Play 5 songs
- [x] Trigger 2 errors
- [x] Run `/health reset`
- [x] Verify success message
- [x] Run `/health metrics`
- [x] Verify all counters reset to 0
- [x] Verify uptime NOT reset (only metrics)

### 4.6 Lavalink Monitoring Tests

**Test Case:** Connection status tracking

- [x] Start bot with Lavalink running
- [x] Verify `lavalink.connected: true`
- [x] Stop Lavalink
- [x] Wait for disconnect event
- [x] Verify `lavalink.connected: false`
- [x] Verify log: "Lavalink disconnected"
- [x] Verify reconnects counter incremented
      **Test Case:** Latency tracking

- [x] Check `/health metrics`
- [x] Verify latency shown (should be low, e.g., <100ms)

---

## 📝 5. Enhanced Logging Testing

### 5.1 Log Rotation Tests

**Test Case:** Automatic rotation at 10MB

- [ ] Set `LOG_TO_FILE=1`
- [ ] Generate lots of logs (loop many error messages)
- [ ] Monitor `logs/logs.txt` file size
- [ ] When it reaches ~10MB, verify:
  - [ ] `logs/logs.txt` → `logs/logs.1.txt`
  - [ ] New `logs/logs.txt` created
- [ ] Continue generating logs
- [ ] Verify rotation continues: `logs.1.txt` → `logs.2.txt`, etc.
- [ ] After 5 rotations, verify `logs.5.txt` gets deleted

**Test Case:** Manual rotation

- [ ] Create large `logs.txt` (>10MB)
- [ ] Restart bot
- [ ] Verify rotation happens on first log write

### 5.2 JSON Logs Tests

**Test Case:** JSON logging enabled

- [ ] Set `JSON_LOGS=1` in `.env`
- [ ] Restart bot
- [ ] Trigger error, warning, info
- [ ] Check `logs/logs.json`
- [ ] Verify each line is valid JSON with:
  - [ ] `timestamp` (ISO format)
  - [ ] `level` (ERROR, WARNING, INFO, etc.)
  - [ ] `message`
  - [ ] `caller` (file name)
  - [ ] Additional data fields

**Test Case:** JSON logging disabled

- [ ] Set `JSON_LOGS=0`
- [ ] Restart bot
- [ ] Verify `logs/logs.json` not created/updated

### 5.3 Log Levels Tests

**Test Case:** LOG_LEVEL=0 (none)

- [ ] Set `LOG_LEVEL=0`
- [ ] Restart bot
- [ ] Verify no console logs appear (except critical errors)

**Test Case:** LOG_LEVEL=1 (warn/error)

- [ ] Set `LOG_LEVEL=1`
- [ ] Trigger info, warning, error
- [ ] Verify only warning and error appear

**Test Case:** LOG_LEVEL=2 (info, default)

- [ ] Set `LOG_LEVEL=2`
- [ ] Trigger debug, info, warning, error
- [ ] Verify info, warning, error appear (no debug)

**Test Case:** LOG_LEVEL=3 (debug)

- [ ] Set `LOG_LEVEL=3`
- [ ] Trigger debug, info, warning, error
- [ ] Verify all appear

### 5.4 Metrics Logging Tests

**Test Case:** Log.metric() function

- [ ] In code, add `Log.metric("test_metric", 42, { tag1: "value1" })`
- [ ] With `LOG_LEVEL=3` and `JSON_LOGS=1`
- [ ] Verify console shows debug message
- [ ] Verify `logs/logs.json` contains metric entry with name, value, tags

---

## 🎯 Integration Testing Flow

### Recommended Testing Sequence

1. **Fresh Start**

   - [ ] Delete `helpers/data/stats.json`
   - [ ] Delete `helpers/data/searchHistory.json`
   - [ ] Delete `logs/logs.txt`
   - [ ] Start Lavalink
   - [ ] Start bot
   - [ ] Verify health monitoring starts

2. **Play Music Session**

   - [ ] Join voice channel
   - [ ] Play 10 different songs from various sources (YouTube, Deezer, Spotify)
   - [ ] Skip 2 songs
   - [ ] Let some songs finish naturally

3. **Verify Auto-Tracking**

   - [ ] Check `/stats` - verify counts updated
   - [ ] Check `/history view` - verify all 10 searches recorded
   - [ ] Check `/wrapped me` - verify stats populated
   - [ ] Check `/health metrics` - verify tracks counted

4. **Test Export Features**

   - [ ] `/history export name:TestHistory`
   - [ ] `/queue export name:TestSession`
   - [ ] Verify both playlists created
   - [ ] Play both playlists to confirm

5. **Test Admin Commands**

   - [ ] `/health status` - check overall health
   - [ ] `/health metrics` - review all metrics
   - [ ] Trigger an error (invalid command)
   - [ ] `/health errors` - verify error recorded
   - [ ] `/health reset` - clear metrics

6. **Test Logging**

   - [ ] Check `logs/logs.txt` exists and has content
   - [ ] Enable `JSON_LOGS=1`, restart
   - [ ] Check `logs/logs.json` created
   - [ ] Generate >10MB logs, verify rotation

7. **Multi-Server Testing**

   - [ ] Join Server A, play 5 songs
   - [ ] Join Server B, play 5 songs
   - [ ] In Server A: `/history view server-only:true` (only A songs)
   - [ ] In Server A: `/history view server-only:false` (A + B songs)
   - [ ] `/wrapped server` in both servers (different stats)

8. **Persistence Testing**
   - [ ] Play songs, check stats
   - [ ] Restart bot
   - [ ] Verify all stats preserved
   - [ ] Verify history preserved
   - [ ] Verify health metrics reset (except uptime)

---

## ✅ Success Criteria

### Critical (Must Pass)

- [ ] No crashes or uncaught errors during normal operation
- [ ] All commands respond without errors
- [ ] Stats accurately track plays, skips, time
- [ ] Search history saves and retrieves correctly
- [ ] Queue export creates playable playlists
- [ ] Health monitoring tracks metrics
- [ ] Logs rotate at 10MB without data loss

### High Priority

- [ ] Pagination works correctly in all views
- [ ] Voice channel guards prevent unauthorized use
- [ ] DJ mode integration works (if enabled)
- [ ] Server filtering works correctly
- [ ] Duplicate prevention in exports
- [ ] Error logs capture full context

### Medium Priority

- [ ] Wrapped embeds display correctly
- [ ] Time ago formatting is accurate
- [ ] Streak calculations are correct
- [ ] Activity level thresholds make sense
- [ ] Health status detects real issues

### Nice to Have

- [ ] Performance: commands respond quickly (<1s)
- [ ] Memory: no memory leaks over 24h test
- [ ] UX: embeds look good, buttons work smoothly
- [ ] Logs: easy to read and debug

---

## 🐛 Known Issues / Edge Cases to Test

- [ ] What happens if user has 0 songs in history but tries to replay?
- [ ] What if two users export history with same playlist name?
- [ ] What if queue is very long (100+ songs) for export?
- [ ] What if search history hits exactly 100 songs (boundary)?
- [ ] What if bot loses permission to send messages mid-command?
- [ ] What if Lavalink disconnects during `/play`?
- [ ] What if log file is manually deleted while bot running?
- [ ] What if `stats.json` becomes corrupted?
- [ ] What if wrapped is requested during active playback?
- [ ] What if health metrics overflow (very large numbers)?

---

## 📊 Testing Checklist Summary

**Total Test Cases:** ~80+

**Estimated Testing Time:** 4-6 hours (comprehensive)

**Priority Order:**

1. Search history (critical for user data)
2. Queue export (data integrity)
3. Health monitoring (admin tools)
4. Wrapped stats (user-facing feature)
5. Logging enhancements (background feature)

**Required Environment:**

- 2+ Discord servers for multi-server testing
- 2+ user accounts (admin + regular user)
- Lavalink instance running
- Ability to trigger errors (for health testing)
- Tools to generate large logs (for rotation testing)

---

## 📝 Test Results Template

```markdown
## Test Session: [Date]

**Tester:** [Name]
**Environment:** [Dev/Staging/Production]
**Bot Version:** 1.0.10

### Search History: ✅ PASS / ❌ FAIL

- Auto-recording: [ ]
- View pagination: [ ]
- Replay: [ ]
- Search: [ ]
- Export: [ ]
- Clear: [ ]
  **Notes:**

### Queue Export: ✅ PASS / ❌ FAIL

- Basic export: [ ]
- Duplicate handling: [ ]
  **Notes:**

### Music Wrapped: ✅ PASS / ❌ FAIL

- Personal wrapped: [ ]
- Server wrapped: [ ]
- Stats detailed: [ ]
- Streak tracking: [ ]
  **Notes:**

### Health Monitoring: ✅ PASS / ❌ FAIL

- Auto-start: [ ]
- Status command: [ ]
- Metrics command: [ ]
- Errors command: [ ]
- Reset command: [ ]
  **Notes:**

### Enhanced Logging: ✅ PASS / ❌ FAIL

- Log rotation: [ ]
- JSON logs: [ ]
- Log levels: [ ]
  **Notes:**

### Overall Status: ✅ READY FOR PRODUCTION / ⚠️ NEEDS FIXES / ❌ BLOCKED

**Critical Issues Found:**
**Recommendations:**
```

---

## 🚀 Post-Testing

After successful testing:

1. [ ] Update TODO.md to mark features as fully tested
2. [ ] Document any bugs found in GitHub Issues
3. [ ] Update patch notes if behavior differs from spec
4. [ ] Create deployment checklist
5. [ ] Backup production data before deploying
6. [ ] Deploy to staging first, then production
7. [ ] Monitor logs and health metrics for 24h post-deploy
8. [ ] Announce new features to users

---

**Good luck with testing! 🎉**
