# Lyrics Feature Status

## Current Implementation ✅

### ✅ What's Working
- **LavaLyrics Plugin (v1.1.0)** - Fully integrated and working
- **LRCLIB Integration** - Primary source for synced lyrics (community-driven, high accuracy)
- **Deezer Lyrics** - Working via LRCLIB fallback (native Deezer lyrics also available)
- **YouTube Lyrics** - Enabled as additional source
- **Genius API** - Fallback for plain text lyrics when synced unavailable
- **Command structure** - `/lyrics synced:true|false` option working
- **Live display logic** - Real-time updating with highlighted current line
- **Player button** - Defaults to synced display
- **Fallback system** - Gracefully falls back to Genius if synced unavailable

### ⚠️ Known Limitations
- **Spotify Lyrics** - Disabled due to sp_dc authentication issues (LavaSrc can't extract secret from current Spotify web player)
- Spotify tracks still get synced lyrics via LRCLIB fallback

## Configuration

Current `application.yml` settings:
```yaml
plugins:
  lavalyrics:
    sources:
      - deezer     # Try Deezer's native lyrics first
      - spotify    # Disabled - auth issues
      - youtube    # YouTube lyrics
      # LRCLIB is automatic fallback

  lavasrc:
    lyrics-sources:
      deezer: true
      spotify: false  # Disabled
      youtube: true
      lrcLib: true    # Primary synced lyrics source
```

## How It Works

1. **User requests lyrics** (via `/lyrics synced:true` or player button)
2. **Bot fetches from Lavalink** using `/v4/lyrics?track={encoded}` endpoint
3. **LavaLyrics checks sources in priority order:**
   - Deezer native lyrics (if Deezer track)
   - LRCLIB (community synced lyrics database)
   - YouTube lyrics
4. **If synced lyrics found:** Returns `lines[]` array with timestamps
5. **If only plain text:** Returns `text` string
6. **If nothing from Lavalink:** Falls back to Genius API

## Synced Lyrics Display

When synced lyrics are available:
- Shows **2 lines before** and **3 lines after** current position
- Current line highlighted with **▶** prefix
- Timestamps shown for each line
- Updates every **2 seconds**
- Shows progress: "Line X of Y"

## Testing

Run the test script to verify lyrics are working:
```bash
node test-deezer-lyrics.js
```

Expected results:
- Deezer tracks: Synced lyrics from LRCLIB (50-100+ lines with timestamps)
- Spotify tracks: Synced lyrics from LRCLIB
- YouTube tracks: Plain text or synced (varies)

## Troubleshooting

### "No lyrics managers registered"
This error is resolved. Make sure:
1. `lavalyrics-plugin:1.1.0` is in plugins list
2. `lyrics-sources` is configured under `lavasrc` section
3. Lavalink is restarted after config changes

### Lyrics not synced
- LRCLIB may not have lyrics for obscure tracks
- Falls back to Genius (plain text)
- Some tracks simply don't have synced lyrics available

### Spotify auth failing
- sp_dc cookie authentication is broken in current Spotify web player
- Workaround: Use LRCLIB which works for most popular Spotify tracks
