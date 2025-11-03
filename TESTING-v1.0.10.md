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

- [ ] Start fresh bot instance
- [ ] Join voice channel
- [ ] Verify `helpers/data/searchHistory.json` doesn't exist yet

### 1.1 Auto-Recording Tests

**Test Case:** Search history auto-saves on `/play`

- [ ] Run `/play query:Marina Bubblegum Bitch`
- [ ] Verify track plays successfully
- [ ] Check `helpers/data/searchHistory.json` created
- [ ] Verify entry contains:
  - [ ] `query` field matches "Marina Bubblegum Bitch"
  - [ ] `track` object has title, author, identifier, uri, length, sourceName
  - [ ] `guildId` matches current server
  - [ ] `timestamp` is valid ISO date
- [ ] Play 4 more different songs
- [ ] Verify history has 5 entries (newest last)

**Test Case:** Playlists don't record in history

- [ ] Run `/play query:spotify playlist url`
- [ ] Verify no new history entry created (playlists excluded)

**Test Case:** Maximum history limit (100 entries)

- [ ] Simulate 100+ searches (can mock in code or play 100 songs)
- [ ] Verify only last 100 entries kept (FIFO queue)

### 1.2 `/history view` Tests

**Test Case:** Basic view with pagination

- [ ] Run `/history view`
- [ ] Verify embed shows:
  - [ ] Title: "🕒 Your Search History"
  - [ ] Up to 15 entries (oldest first)
  - [ ] Each entry: number, title, artist, duration, source, time ago
- [ ] Verify "Next" button appears if >15 entries
- [ ] Click "Next" button
- [ ] Verify page 2 displays next 15 entries
- [ ] Verify "Previous" button appears
- [ ] Click "Previous" to return to page 1

**Test Case:** Server filtering

- [ ] Play songs in Server A
- [ ] Play songs in Server B
- [ ] In Server A, run `/history view server-only:true`
- [ ] Verify only Server A songs shown
- [ ] Run `/history view server-only:false`
- [ ] Verify both Server A and B songs shown

**Test Case:** Empty history

- [ ] Fresh user (or clear history)
- [ ] Run `/history view`
- [ ] Verify message: "Your search history is empty!"

### 1.3 `/history replay` Tests

**Test Case:** Replay track from history

- [ ] Run `/history view` to see list
- [ ] Note a track number (e.g., #3)
- [ ] Run `/history replay number:3`
- [ ] Verify track queued/played successfully
- [ ] Verify success message shows track title

**Test Case:** Prepend option

- [ ] Have 3+ songs in queue
- [ ] Run `/history replay number:1 prepend:true`
- [ ] Verify track added to front of queue (plays next)
- [ ] Run `/history replay number:2 prepend:false`
- [ ] Verify track added to end of queue

**Test Case:** Invalid track number

- [ ] Run `/history replay number:999`
- [ ] Verify error: "Track not found at position 999"

**Test Case:** Voice channel checks

- [ ] Leave voice channel
- [ ] Run `/history replay number:1`
- [ ] Verify error: "You need to be in a voice channel"

### 1.4 `/history search` Tests

**Test Case:** Search by title

- [ ] Play: "Marina - Bubblegum Bitch", "MARINA - Primadonna", "Arctic Monkeys - Do I Wanna Know"
- [ ] Run `/history search query:Marina`
- [ ] Verify both Marina songs appear
- [ ] Verify Arctic Monkeys does not appear

**Test Case:** Search by artist

- [ ] Run `/history search query:Arctic Monkeys`
- [ ] Verify "Do I Wanna Know" appears

**Test Case:** Case-insensitive search

- [ ] Run `/history search query:MARINA`
- [ ] Run `/history search query:marina`
- [ ] Run `/history search query:MaRiNa`
- [ ] Verify all return same results

**Test Case:** No results

- [ ] Run `/history search query:NonexistentSong123`
- [ ] Verify message: "No matching tracks found"

### 1.5 `/history export` Tests

**Test Case:** Export to playlist

- [ ] Play 5 different songs
- [ ] Run `/history export name:MyHistoryPlaylist`
- [ ] Verify success message shows track count
- [ ] Run `/playlist list`
- [ ] Verify "MyHistoryPlaylist" exists
- [ ] Run `/playlist play name:MyHistoryPlaylist`
- [ ] Verify all 5 songs queue correctly

**Test Case:** Export with limit

- [ ] Have 20 songs in history
- [ ] Run `/history export name:Top10 limit:10`
- [ ] Verify playlist has only 10 tracks (most recent)

**Test Case:** Server filtering in export

- [ ] Have songs from 2 servers in history
- [ ] In Server A, run `/history export name:ServerA server-only:true`
- [ ] Verify playlist contains only Server A songs

**Test Case:** Empty history export

- [ ] Clear history
- [ ] Run `/history export name:Empty`
- [ ] Verify error: "Your history is empty"

### 1.6 `/history clear` Tests

**Test Case:** Clear all history

- [ ] Have 10+ songs in history
- [ ] Run `/history clear`
- [ ] Confirm in modal
- [ ] Verify success message
- [ ] Run `/history view`
- [ ] Verify empty history

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

- [ ] Join voice channel
- [ ] Play 3 songs (let them finish)
- [ ] Add 2 songs to queue
- [ ] Currently playing 1 song
- [ ] Run `/queue export name:MySession`
- [ ] Verify success message shows:
  - [ ] Total tracks (should be 6: 3 history + 1 current + 2 queue)
  - [ ] Added count
  - [ ] Skipped count (if any duplicates)
- [ ] Run `/playlist play name:MySession`
- [ ] Verify all 6 songs queue in correct order

**Test Case:** Export with empty queue

- [ ] Play 1 song (let it finish)
- [ ] Queue is now empty
- [ ] Run `/queue export name:SingleTrack`
- [ ] Verify playlist created with just the 1 track from history

**Test Case:** No session state

- [ ] Fresh guild, never played music
- [ ] Run `/queue export name:Empty`
- [ ] Verify error: "No active playback session"

**Test Case:** Duplicate handling

- [ ] Play same song 3 times
- [ ] Run `/queue export name:Duplicates`
- [ ] Verify skipped count shows duplicates removed
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

- [ ] Play 20+ songs with variety of artists
- [ ] Run `/wrapped me`
- [ ] Verify embed shows:
  - [ ] User's avatar thumbnail
  - [ ] Total songs played
  - [ ] Total listening time (hours and days)
  - [ ] Average songs per day
  - [ ] Activity level (e.g., "Regular User 🎵")
  - [ ] Top 5 tracks with play counts
  - [ ] Top 5 artists with song counts
  - [ ] Most active hour
  - [ ] Favorite source
  - [ ] Current streak (if listened today/yesterday)
  - [ ] Longest streak
  - [ ] Footer with "Member since" and "Last active"

**Test Case:** Fresh user wrapped

- [ ] New user (never played music)
- [ ] Run `/wrapped me`
- [ ] Verify message: "You haven't listened to any music yet!"

**Test Case:** View another user's wrapped

- [ ] Have User A play 10 songs
- [ ] User B runs `/wrapped me user:@UserA`
- [ ] Verify User A's stats displayed (not User B's)

### 3.3 `/wrapped server` Tests

**Test Case:** Server-wide wrapped

- [ ] Have 2+ users play music
- [ ] Run `/wrapped server`
- [ ] Verify embed shows:
  - [ ] Server icon thumbnail
  - [ ] Total songs played
  - [ ] Total playtime
  - [ ] Total listening sessions
  - [ ] Avg songs per session
  - [ ] Unique listeners count
  - [ ] Peak listeners count
  - [ ] Songs skipped
  - [ ] Playlists added
  - [ ] Top 5 sources with percentages
  - [ ] Most active hour
  - [ ] Footer with "Music playing since"

**Test Case:** Fresh server

- [ ] New guild (no music played)
- [ ] Run `/wrapped server`
- [ ] Verify message: "No music has been played in this server yet!"

### 3.4 `/stats detailed:true` Tests

**Test Case:** Basic stats view

- [ ] Run `/stats`
- [ ] Verify shows guild + global stats (as before)

**Test Case:** Detailed stats view

- [ ] Run `/stats detailed:true`
- [ ] Verify additional fields appear:
  - [ ] "📻 Top Sources" section with top 5 and percentages
  - [ ] "⏰ Most Active Hour" section with hour and song count

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

- [ ] Start bot
- [ ] Check logs for "Health monitoring started"
- [ ] Wait 30 seconds
- [ ] Verify event loop lag measured (check metrics)

**Test Case:** Command tracking

- [ ] Run 5 successful commands
- [ ] Run 1 command that fails (e.g., invalid input)
- [ ] Get metrics: verify `commands.total: 6`, `successful: 5`, `failed: 1`

**Test Case:** Track events recorded

- [ ] Play 3 songs successfully
- [ ] Play 1 song that fails to load
- [ ] Skip 1 song
- [ ] Get metrics: verify `tracks.played: 3`, `tracks.failed: 1`, `tracks.skipped: 1`

**Test Case:** Error recording

- [ ] Trigger an error (e.g., invalid Lavalink command)
- [ ] Verify error appears in health metrics
- [ ] Verify error logged to `logs/logs.txt`

### 4.2 `/health status` Tests (Admin Only)

**Test Case:** Healthy status

- [ ] Fresh bot with no issues
- [ ] Run `/health status`
- [ ] Verify:
  - [ ] Overall status: "✅ Healthy"
  - [ ] No issues listed
  - [ ] Quick metrics shown (uptime, memory, Lavalink, commands)
  - [ ] No recent errors section (if none)

**Test Case:** Issues detected

- [ ] Trigger high memory usage (load many large files)
- [ ] OR disconnect Lavalink
- [ ] Run `/health status`
- [ ] Verify:
  - [ ] Overall status: "❌ Issues Detected"
  - [ ] Issues listed (e.g., "Lavalink not connected")

**Test Case:** Non-admin user

- [ ] Regular user (no admin permissions)
- [ ] Run `/health status`
- [ ] Verify error: "You need Administrator permission"

### 4.3 `/health metrics` Tests

**Test Case:** Detailed metrics view

- [ ] Run `/health metrics`
- [ ] Verify embed shows:
  - [ ] **System** section: platform, Node version, uptime
  - [ ] **Memory** section: heap used/total, RSS, system totals
  - [ ] **CPU** section: usage %, cores, event loop lag
  - [ ] **Lavalink** section: status, reconnects, latency
  - [ ] **Commands** section: total, successful, failed, success rate %
  - [ ] **Tracks** section: played, failed, skipped
  - [ ] **Errors & Warnings** section: total counts, recent errors

### 4.4 `/health errors` Tests

**Test Case:** View recent errors

- [ ] Trigger 3 different errors
- [ ] Run `/health errors`
- [ ] Verify shows last 5 errors (default)
- [ ] Each error shows: timestamp, message, context

**Test Case:** Custom limit

- [ ] Trigger 10 errors
- [ ] Run `/health errors limit:3`
- [ ] Verify shows only 3 most recent

**Test Case:** No errors

- [ ] Fresh bot
- [ ] Run `/health errors`
- [ ] Verify message: "No errors recorded! 🎉"

### 4.5 `/health reset` Tests

**Test Case:** Reset metrics

- [ ] Run 10 commands
- [ ] Play 5 songs
- [ ] Trigger 2 errors
- [ ] Run `/health reset`
- [ ] Verify success message
- [ ] Run `/health metrics`
- [ ] Verify all counters reset to 0
- [ ] Verify uptime NOT reset (only metrics)

### 4.6 Lavalink Monitoring Tests

**Test Case:** Connection status tracking

- [ ] Start bot with Lavalink running
- [ ] Verify `lavalink.connected: true`
- [ ] Stop Lavalink
- [ ] Wait for disconnect event
- [ ] Verify `lavalink.connected: false`
- [ ] Verify log: "Lavalink disconnected"
- [ ] Verify reconnects counter incremented

**Test Case:** Latency tracking

- [ ] Check `/health metrics`
- [ ] Verify latency shown (should be low, e.g., <100ms)

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
