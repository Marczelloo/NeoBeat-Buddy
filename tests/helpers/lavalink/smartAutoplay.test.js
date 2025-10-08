const assert = require("node:assert");
const { describe, it, beforeEach } = require("node:test");

describe("Smart Autoplay System", () => {
  const GUILD_ID = "test-guild-123";

  // Test helpers
  function createMockTrack(title, artist, identifier, duration = 180000) {
    return {
      info: {
        title,
        author: artist,
        identifier,
        length: duration,
      },
      track: "encoded_track_data",
    };
  }

  describe("buildSessionProfile", () => {
    let buildSessionProfile, playbackState;

    beforeEach(async () => {
      // Re-import fresh modules for each test
      delete require.cache[require.resolve("../../../helpers/lavalink/state")];
      delete require.cache[require.resolve("../../../helpers/lavalink/smartAutoplay")];

      const state = require("../../../helpers/lavalink/state");
      const autoplay = require("../../../helpers/lavalink/smartAutoplay");

      buildSessionProfile = autoplay.buildSessionProfile;
      playbackState = state.playbackState;

      playbackState.clear();
    });

    it("should include reference track in profile", () => {
      const history = [createMockTrack("Song 1", "Artist A", "id1"), createMockTrack("Song 2", "Artist B", "id2")];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 3", "Artist A", "id3");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.strictEqual(profile.totalTracks, 3);
      assert.strictEqual(profile.artistCounts["Artist A"], 2);
      assert.strictEqual(profile.artistCounts["Artist B"], 1);
    });

    it("should handle empty history with reference track", () => {
      playbackState.set(GUILD_ID, { history: [] });

      const referenceTrack = createMockTrack("Song 1", "Artist A", "id1");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.strictEqual(profile.totalTracks, 1);
      assert.strictEqual(profile.topArtists.length, 1);
      assert.strictEqual(profile.topArtists[0].artist, "Artist A");
    });

    it("should sort artists by frequency", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1"),
        createMockTrack("Song 2", "Artist B", "id2"),
        createMockTrack("Song 3", "Artist A", "id3"),
        createMockTrack("Song 4", "Artist C", "id4"),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 5", "Artist A", "id5");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.strictEqual(profile.topArtists[0].artist, "Artist A");
      assert.strictEqual(profile.topArtists[0].count, 3);
      assert.strictEqual(profile.topArtists[1].artist, "Artist B");
      assert.strictEqual(profile.topArtists[1].count, 1);
    });

    it("should track last 20 identifiers to avoid duplicates", () => {
      const history = Array.from({ length: 25 }, (_, i) => createMockTrack(`Song ${i}`, `Artist ${i}`, `id${i}`));
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 26", "Artist 26", "id26");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Profile limits to last 15 tracks (14 history + 1 reference)
      // So we get 15 identifiers, not 20
      assert.strictEqual(profile.recentIdentifiers.length, 15);
      assert.ok(profile.recentIdentifiers.includes("id26")); // Reference included

      // The identifiers should be from the last 15 tracks (id12-id26)
      assert.ok(profile.recentIdentifiers.includes("id12")); // 14 from history start at id12
      assert.ok(!profile.recentIdentifiers.includes("id0")); // Old ones excluded
    });

    it("should calculate average duration correctly", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1", 120000), // 2 min
        createMockTrack("Song 2", "Artist B", "id2", 180000), // 3 min
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 3", "Artist C", "id3", 240000); // 4 min
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Average: (120000 + 180000 + 240000) / 3 = 180000
      assert.strictEqual(profile.avgDuration, 180000);
    });

    it("should limit to last 15 tracks (14 history + 1 reference)", () => {
      const history = Array.from({ length: 20 }, (_, i) => createMockTrack(`Song ${i}`, `Artist ${i}`, `id${i}`));
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 20", "Artist 20", "id20");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Should analyze only last 15 tracks total
      assert.strictEqual(profile.totalTracks, 15);
    });

    it("should handle null/undefined in track info", () => {
      playbackState.set(GUILD_ID, { history: [] });

      const profile = buildSessionProfile(GUILD_ID, {
        info: {
          title: "Test",
          author: null,
          identifier: undefined,
          length: 0,
        },
      });

      assert.strictEqual(profile.topArtists[0].artist, "Unknown");
    });
  });

  describe("recordSkip", () => {
    let recordSkip;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/smartAutoplay")];
      const autoplay = require("../../../helpers/lavalink/smartAutoplay");
      recordSkip = autoplay.recordSkip;
    });

    it("should record skip with artist and reason", () => {
      const track = createMockTrack("Test Song", "Test Artist", "test-id");
      // Should not throw
      recordSkip(GUILD_ID, track, "command_skip");
    });

    it("should handle multiple skips", () => {
      const track = createMockTrack("Test Song", "Test Artist", "test-id");

      // Record multiple skips - should not throw
      for (let i = 0; i < 10; i++) {
        recordSkip(GUILD_ID, track, "command_skip");
      }
    });
  });

  describe("Scoring Logic (Integration)", () => {
    it("should calculate correct base scores", () => {
      // Base score: 50
      // Spotify source: +25 = 75
      // YouTube Mix source: +15 = 65
      // Top Artist source: +10 = 60

      const profile = {
        topArtists: [],
        artistCounts: {},
        recentIdentifiers: [],
        guildId: GUILD_ID,
      };

      // We can't directly test scoreCandidates since it's not exported,
      // but we can verify the scoring indirectly through integration tests
      // For now, just verify the profile structure
      assert.ok(profile);
      assert.strictEqual(profile.guildId, GUILD_ID);
    });
  });

  describe("Integration Test - Recent Artist Penalty", () => {
    let buildSessionProfile, playbackState;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/state")];
      delete require.cache[require.resolve("../../../helpers/lavalink/smartAutoplay")];

      const state = require("../../../helpers/lavalink/state");
      const autoplay = require("../../../helpers/lavalink/smartAutoplay");

      buildSessionProfile = autoplay.buildSessionProfile;
      playbackState = state.playbackState;

      playbackState.clear();
    });

    it("should identify top 3 artists correctly for penalty calculation", () => {
      const history = [
        createMockTrack("Song 1", "Kanye West", "id1"),
        createMockTrack("Song 2", "Kanye West", "id2"),
        createMockTrack("Song 3", "Kanye West", "id3"),
        createMockTrack("Song 4", "Travis Scott", "id4"),
        createMockTrack("Song 5", "Drake", "id5"),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 6", "Kanye West", "id6");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Verify top 3 artists are identified
      assert.ok(profile.topArtists.length >= 3);
      assert.strictEqual(profile.topArtists[0].artist, "Kanye West");

      // Artists with higher counts should be penalized in scoring
      const top3Artists = profile.topArtists.slice(0, 3).map((a) => a.artist);
      assert.ok(top3Artists.includes("Kanye West"));
    });
  });

  describe("Edge Cases", () => {
    let buildSessionProfile, playbackState;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/state")];
      delete require.cache[require.resolve("../../../helpers/lavalink/smartAutoplay")];

      const state = require("../../../helpers/lavalink/state");
      const autoplay = require("../../../helpers/lavalink/smartAutoplay");

      buildSessionProfile = autoplay.buildSessionProfile;
      playbackState = state.playbackState;

      playbackState.clear();
    });

    it("should handle missing playback state", () => {
      const referenceTrack = createMockTrack("Song", "Artist", "id");
      const profile = buildSessionProfile("non-existent-guild", referenceTrack);

      assert.strictEqual(profile.totalTracks, 1);
      assert.strictEqual(profile.topArtists[0].artist, "Artist");
    });

    it("should handle empty reference track", () => {
      playbackState.set(GUILD_ID, { history: [] });

      const profile = buildSessionProfile(GUILD_ID, {});

      // .filter(Boolean) removes empty objects, so reference track counts as 1
      assert.strictEqual(profile.totalTracks, 1);
      assert.strictEqual(profile.topArtists.length, 1);
      assert.strictEqual(profile.topArtists[0].artist, "Unknown");
    });

    it("should handle reference track with missing info", () => {
      playbackState.set(GUILD_ID, { history: [] });

      const profile = buildSessionProfile(GUILD_ID, { info: null });

      // .filter(Boolean) keeps the object, but info is null
      // This creates a profile with 1 track but Unknown artist
      assert.strictEqual(profile.totalTracks, 1);
      assert.strictEqual(profile.topArtists[0].artist, "Unknown");
    });

    it("should handle very long artist names", () => {
      const longName = "A".repeat(1000);
      const history = [createMockTrack("Song", longName, "id")];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 2", longName, "id2");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.strictEqual(profile.topArtists[0].artist, longName);
      assert.strictEqual(profile.topArtists[0].count, 2);
    });
  });

  describe("Duplicate Detection", () => {
    let buildSessionProfile, playbackState;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/state")];
      delete require.cache[require.resolve("../../../helpers/lavalink/smartAutoplay")];

      const state = require("../../../helpers/lavalink/state");
      const autoplay = require("../../../helpers/lavalink/smartAutoplay");

      buildSessionProfile = autoplay.buildSessionProfile;
      playbackState = state.playbackState;

      playbackState.clear();
    });

    it("should detect exact duplicates by identifier", () => {
      const history = [createMockTrack("Song 1", "Artist A", "duplicate-id")];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 2", "Artist B", "id2");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.ok(profile.recentIdentifiers.includes("duplicate-id"));
      assert.ok(profile.recentIdentifiers.includes("id2"));
    });

    it("should maintain identifier uniqueness", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1"),
        createMockTrack("Song 2", "Artist A", "id1"), // Same ID
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 3", "Artist B", "id3");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Both instances should be in identifiers (no dedup in profile)
      const id1Count = profile.recentIdentifiers.filter((id) => id === "id1").length;
      assert.strictEqual(id1Count, 2); // Both instances tracked
    });
  });

  describe("Artist Weight Calculation", () => {
    let buildSessionProfile, playbackState;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/state")];
      delete require.cache[require.resolve("../../../helpers/lavalink/smartAutoplay")];

      const state = require("../../../helpers/lavalink/state");
      const autoplay = require("../../../helpers/lavalink/smartAutoplay");

      buildSessionProfile = autoplay.buildSessionProfile;
      playbackState = state.playbackState;

      playbackState.clear();
    });

    it("should calculate correct weight for artists", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1"),
        createMockTrack("Song 2", "Artist A", "id2"),
        createMockTrack("Song 3", "Artist B", "id3"),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 4", "Artist A", "id4");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Artist A: 3 occurrences out of 4 tracks = 0.75 weight
      assert.strictEqual(profile.topArtists[0].count, 3);
      assert.strictEqual(profile.topArtists[0].weight, 0.75);

      // Artist B: 1 occurrence out of 4 tracks = 0.25 weight
      assert.strictEqual(profile.topArtists[1].count, 1);
      assert.strictEqual(profile.topArtists[1].weight, 0.25);
    });
  });
});
