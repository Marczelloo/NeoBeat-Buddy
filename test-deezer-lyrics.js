/**
 * Test script for Deezer synced lyrics
<<<<<<< HEAD
 *
=======
 * 
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
 * This script mimics real bot behavior with session and player
 * Run with: node test-deezer-lyrics.js
 */

require("dotenv").config();
const fetch = require("node-fetch");

const LAVALINK_HOST = process.env.LAVALINK_HOST || "localhost";
const LAVALINK_PORT = process.env.LAVALINK_PORT || 2333;
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "youshallnotpass";

const SESSION_ID = "test-session-" + Date.now();
const GUILD_ID = "123456789";

async function testLyrics() {
  console.log("🔌 Connecting to Lavalink...");
  console.log(`   Host: ${LAVALINK_HOST}:${LAVALINK_PORT}`);
  console.log(`   Session: ${SESSION_ID}`);
  console.log(`   Guild: ${GUILD_ID}`);
  console.log("");

  const baseUrl = `http://${LAVALINK_HOST}:${LAVALINK_PORT}`;
  const headers = {
    Authorization: LAVALINK_PASSWORD,
    "Content-Type": "application/json",
  };

  try {
    // Check Lavalink status
    const infoResponse = await fetch(`${baseUrl}/v4/info`, { headers });
<<<<<<< HEAD

=======
    
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
    if (!infoResponse.ok) {
      console.error("❌ Lavalink connection failed");
      console.error(`   Status: ${infoResponse.status} ${infoResponse.statusText}`);
      return;
    }

    const info = await infoResponse.json();
    console.log("✅ Connected to Lavalink");
    console.log(`   Version: ${info.version.semver}`);
<<<<<<< HEAD
    console.log(`   Plugins: ${info.plugins?.map((p) => p.name).join(", ") || "none"}`);
=======
    console.log(`   Plugins: ${info.plugins?.map(p => p.name).join(", ") || "none"}`);
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
    console.log("");

    // Test tracks
    const testQueries = [
      { query: "dzsearch:Ed Sheeran Shape of You", name: "Deezer - Ed Sheeran Shape of You", type: "synced" },
      { query: "dzsearch:Adele Hello", name: "Deezer - Adele Hello", type: "synced" },
      { query: "spsearch:Billie Eilish Bad Guy", name: "Spotify - Billie Eilish Bad Guy", type: "synced" },
      { query: "spsearch:The Weeknd Blinding Lights", name: "Spotify - The Weeknd Blinding Lights", type: "synced" },
      { query: "ytsearch:Imagine Dragons Believer", name: "YouTube - Imagine Dragons Believer", type: "plain" },
    ];

    for (const { query, name, type } of testQueries) {
      console.log(`🔍 Testing: ${name}`);
      console.log(`   🔎 Expected: ${type} lyrics`);

      try {
        // Search for track
        const searchUrl = `${baseUrl}/v4/loadtracks?identifier=${encodeURIComponent(query)}`;
        const searchResponse = await fetch(searchUrl, { headers });

        if (!searchResponse.ok) {
          console.log(`   ❌ Search failed: ${searchResponse.status}`);
          console.log("");
          continue;
        }

        const result = await searchResponse.json();

        if (!result.data || result.data.length === 0) {
          console.log("   ❌ No tracks found");
          console.log("");
          continue;
        }

        const track = result.data[0];
        console.log(`   📀 Track: ${track.info.title} by ${track.info.author}`);
        console.log(`   🎵 Source: ${track.info.sourceName}`);
        console.log(`   ⏱️  Duration: ${Math.floor(track.info.length / 1000)}s`);

        // Fetch lyrics from LavaLyrics
        console.log("   📜 Fetching lyrics from LavaLyrics...");
        const encodedTrack = encodeURIComponent(track.encoded);
        const lyricsUrl = `${baseUrl}/v4/lyrics?track=${encodedTrack}`;
        const lyricsResponse = await fetch(lyricsUrl, { headers });

        if (lyricsResponse.ok) {
          const lyrics = await lyricsResponse.json();
          const isSynced = lyrics.lines && Array.isArray(lyrics.lines) && lyrics.lines.length > 0;
<<<<<<< HEAD

=======
          
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
          console.log(`   ✅ Lyrics found!`);
          console.log(`   📚 Source: ${lyrics.sourceName || "unknown"}`);
          console.log(`   🏷️  Provider: ${lyrics.provider || "unknown"}`);
          console.log(`   🔢 Type: ${isSynced ? "Synced (LRC)" : "Plain text"}`);

          if (isSynced) {
            console.log(`   📝 Total lines: ${lyrics.lines.length}`);
            console.log(`   ⏰ First timestamp: ${lyrics.lines[0].timestamp}ms`);
            console.log(`   ⏰ Last timestamp: ${lyrics.lines[lyrics.lines.length - 1].timestamp}ms`);
            console.log(`   📄 First 5 synced lines:`);
            lyrics.lines.slice(0, 5).forEach((line) => {
              const timestamp = line.timestamp
<<<<<<< HEAD
                ? `[${Math.floor(line.timestamp / 60000)}:${String(
                    Math.floor((line.timestamp % 60000) / 1000)
                  ).padStart(2, "0")}]`
=======
                ? `[${Math.floor(line.timestamp / 60000)}:${String(Math.floor((line.timestamp % 60000) / 1000)).padStart(
                    2,
                    "0"
                  )}]`
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
                : "";
              console.log(`      ${timestamp} ${line.line}`);
            });
            console.log(`   📄 Last 3 synced lines:`);
            lyrics.lines.slice(-3).forEach((line) => {
              const timestamp = line.timestamp
<<<<<<< HEAD
                ? `[${Math.floor(line.timestamp / 60000)}:${String(
                    Math.floor((line.timestamp % 60000) / 1000)
                  ).padStart(2, "0")}]`
=======
                ? `[${Math.floor(line.timestamp / 60000)}:${String(Math.floor((line.timestamp % 60000) / 1000)).padStart(
                    2,
                    "0"
                  )}]`
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
                : "";
              console.log(`      ${timestamp} ${line.line}`);
            });
          } else if (lyrics.text) {
<<<<<<< HEAD
            const textLines = lyrics.text.split("\n").filter((l) => l.trim());
            console.log(`   📝 Plain text lines: ${textLines.length}`);
            console.log(`   📄 First 5 lines:`);
            textLines.slice(0, 5).forEach((line) => {
=======
            const textLines = lyrics.text.split('\n').filter(l => l.trim());
            console.log(`   📝 Plain text lines: ${textLines.length}`);
            console.log(`   📄 First 5 lines:`);
            textLines.slice(0, 5).forEach(line => {
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
              console.log(`      ${line.slice(0, 80)}`);
            });
            if (textLines.length > 5) {
              console.log(`   📄 Last 3 lines:`);
<<<<<<< HEAD
              textLines.slice(-3).forEach((line) => {
=======
              textLines.slice(-3).forEach(line => {
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
                console.log(`      ${line.slice(0, 80)}`);
              });
            }
          }
        } else if (lyricsResponse.status === 204) {
          console.log("   📜 No lyrics available (204 No Content)");
        } else {
          console.log(`   ❌ Lyrics fetch failed: ${lyricsResponse.status}`);
          if (lyricsResponse.status === 500) {
            const errorText = await lyricsResponse.text().catch(() => "");
            if (errorText.length < 200) {
              console.log(`   ⚠️  Error: ${errorText}`);
            } else {
              console.log(`   ⚠️  Error: ${errorText.slice(0, 150)}...`);
            }
          }
        }

        console.log("");
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        console.log("");
      }
    }

    console.log("✨ Test completed!");
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    console.error(err);
  }

  process.exit(0);
}

testLyrics();
