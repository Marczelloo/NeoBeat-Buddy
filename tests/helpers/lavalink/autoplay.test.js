const assert = require("node:assert");
const { describe, it, beforeEach } = require("node:test");

describe("Autoplay System - Session Profile", () => {
  const GUILD_ID = "test-guild-456";

  function createMockTrack(title, artist, identifier, options = {}) {
    return {
      info: {
        title,
        author: artist,
        identifier,
        length: options.duration || 180000,
      },
      track: `encoded_${identifier}`,
      userData: {
        genres: options.genres || [],
        features: options.features || null,
        releaseYear: options.releaseYear || null,
      },
    };
  }

  describe("buildSessionProfile", () => {
    let buildSessionProfile, playbackState, genreCache;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/state")];
      delete require.cache[require.resolve("../../../helpers/lavalink/sessionProfile")];

      const state = require("../../../helpers/lavalink/state");
      const sessionProfile = require("../../../helpers/lavalink/sessionProfile");

      buildSessionProfile = sessionProfile.buildSessionProfile;
      genreCache = sessionProfile.genreCache;
      playbackState = state.playbackState;

      playbackState.clear();
      genreCache.clear();
    });

    it("should build profile from genre cache", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1", { genres: ["rock", "alternative"], features: { tempo: 120 } }),
        createMockTrack("Song 2", "Artist B", "id2", { genres: ["rock"], features: { tempo: 125 } }),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 3", "Artist A", "id3");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.ok(profile.topGenres.length > 0);
      assert.strictEqual(profile.topGenres[0].genre, "rock"); // Most common
    });

    it("should calculate average tempo from cached features", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1", { genres: [], features: { tempo: 100 } }),
        createMockTrack("Song 2", "Artist B", "id2", { genres: [], features: { tempo: 140 } }),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 3", "Artist A", "id3");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Average of 100 and 140 = 120
      assert.strictEqual(profile.avgTempo, 120);
    });

    it("should track last 3 artists for diversity", () => {
      const history = [
        createMockTrack("Song 1", "Artist A", "id1"),
        createMockTrack("Song 2", "Artist B", "id2"),
        createMockTrack("Song 3", "Artist C", "id3"),
        createMockTrack("Song 4", "Artist D", "id4"),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 5", "Artist E", "id5");
      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      // Last 3 should be C, D, E (not A, B)
      assert.strictEqual(profile.lastThreeArtists.length, 3);
      assert.ok(profile.lastThreeArtists.includes("Artist E"));
      assert.ok(profile.lastThreeArtists.includes("Artist D"));
      assert.ok(profile.lastThreeArtists.includes("Artist C"));
    });

    it("should detect energy trend from features", () => {
      const history = [
        createMockTrack("Song 1", "Artist", "id1", { genres: [], features: { energy: 0.3 } }),
        createMockTrack("Song 2", "Artist", "id2", { genres: [], features: { energy: 0.5 } }),
        createMockTrack("Song 3", "Artist", "id3", { genres: [], features: { energy: 0.7 } }),
        createMockTrack("Song 4", "Artist", "id4", { genres: [], features: { energy: 0.9 } }),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 5", "Artist", "id5", { genres: [], features: { energy: 0.95 } });

      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.strictEqual(profile.energyTrend, "increasing");
    });

    it("should detect valence trend", () => {
      const history = [
        createMockTrack("Song 1", "Artist", "id1", { genres: [], features: { valence: 0.8 } }),
        createMockTrack("Song 2", "Artist", "id2", { genres: [], features: { valence: 0.6 } }),
        createMockTrack("Song 3", "Artist", "id3", { genres: [], features: { valence: 0.4 } }),
        createMockTrack("Song 4", "Artist", "id4", { genres: [], features: { valence: 0.2 } }),
      ];
      playbackState.set(GUILD_ID, { history });

      const referenceTrack = createMockTrack("Song 5", "Artist", "id5", { genres: [], features: { valence: 0.1 } });

      const profile = buildSessionProfile(GUILD_ID, referenceTrack);

      assert.strictEqual(profile.valenceTrend, "decreasing");
    });
  });
});
