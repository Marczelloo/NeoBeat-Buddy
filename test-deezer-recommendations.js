require("dotenv").config({ debug: true });

/**
 * Test Deezer recommendations via LavaSrc
 * Requires: Deezer ARL cookie + Master Decryption Key in Lavalink config
 *
 * LavaSrc supports:
 * - dzrec:TRACK_ID - recommendations based on track
 * - dzrec:track=TRACK_ID - same as above
 * - dzrec:artist=ARTIST_ID - recommendations based on artist
 */

console.log("🚀 Testing Deezer recommendations via LavaSrc\n");

async function testDeezerRecommendations() {
  try {
    // Step 1: Search for track on Deezer
    const testQuery = "dzsearch:taco hemingway tamagotchi";
    console.log(`🔍 Step 1: Searching Deezer: ${testQuery}`);

    const searchRes = await fetch("http://localhost:2333/v4/loadtracks?identifier=" + encodeURIComponent(testQuery), {
      headers: {
        Authorization: "youshallnotpass",
      },
    });

    const searchData = await searchRes.json();
    console.log("   Load type:", searchData.loadType);

    if (searchData.loadType === "error") {
      console.log("   ❌ Error:", searchData.data.message);
      console.log("\n💡 Deezer source is not configured in Lavalink.");
      console.log("   To enable, add to application.yml:");
      console.log("   plugins:");
      console.log("     lavasrc:");
      console.log("       sources:");
      console.log("         deezer: true");
      console.log("       deezer:");
      console.log("         arl: 'your_deezer_arl_cookie'");
      console.log("         masterDecryptionKey: 'your_master_key'");
      console.log("\n   How to get ARL cookie:");
      console.log("   1. Login to deezer.com");
      console.log("   2. Open DevTools (F12) → Application → Cookies");
      console.log("   3. Copy 'arl' cookie value");
      console.log("\n   Master decryption key is harder to obtain (requires reverse engineering)");
      process.exit(1);
    }

    if (!searchData.data || searchData.data.length === 0) {
      console.log("   ❌ No tracks found on Deezer");
      process.exit(1);
    }

    const track = searchData.data[0];
    console.log("   ✅ Track found:", track.info.title, "by", track.info.author);
    console.log("   Deezer ID:", track.info.identifier);

    // Step 2: Get recommendations via dzrec:
    const dzrecQuery = `dzrec:${track.info.identifier}`;
    console.log(`\n🎯 Step 2: Testing dzrec: ${dzrecQuery}`);

    const dzrecRes = await fetch("http://localhost:2333/v4/loadtracks?identifier=" + encodeURIComponent(dzrecQuery), {
      headers: {
        Authorization: "youshallnotpass",
      },
    });

    const dzrecData = await dzrecRes.json();
    console.log("   Load type:", dzrecData.loadType);

    if (dzrecData.loadType === "error") {
      console.log("   ❌ Error:", dzrecData.data.message);
      process.exit(1);
    }

    if (dzrecData.loadType === "empty") {
      console.log("   ❌ No recommendations returned");
      process.exit(1);
    }

    // Handle playlist response
    if (dzrecData.loadType === "playlist" && dzrecData.data?.tracks) {
      const tracks = dzrecData.data.tracks;
      console.log(`   ✅ Found ${tracks.length} recommendations:\n`);
      tracks.slice(0, 10).forEach((recTrack, i) => {
        console.log(`   ${i + 1}. ${recTrack.info.title} - ${recTrack.info.author}`);
      });
      console.log("\n✅ SUCCESS! Deezer recommendations are working!");
      process.exit(0);
    }

    // Handle search response
    if (dzrecData.loadType === "search" && Array.isArray(dzrecData.data)) {
      const tracks = dzrecData.data;
      console.log(`   ✅ Found ${tracks.length} recommendations:\n`);
      tracks.slice(0, 10).forEach((recTrack, i) => {
        console.log(`   ${i + 1}. ${recTrack.info.title} - ${recTrack.info.author}`);
      });
      console.log("\n✅ SUCCESS! Deezer recommendations are working!");
      process.exit(0);
    }

    console.log("   ❌ Unexpected response format");
    console.log("   Full response:", JSON.stringify(dzrecData, null, 2));
    process.exit(1);
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
}

testDeezerRecommendations();
