const assert = require("node:assert");
const { describe, it, beforeEach, mock } = require("node:test");

/**
 * Comprehensive Autoplay System Tests
 * Tests the redesigned priority-based recommendation system
 */
describe("Autoplay System - Priority-Based Recommendations", () => {
  const GUILD_ID = "test-guild-123";

  // Test helpers
  function createMockTrack(title, artist, identifier, duration = 180000, source = "deezer") {
    return {
      info: {
        title,
        author: artist,
        identifier,
        length: duration,
        sourceName: source,
        uri: `https://${source}.com/track/${identifier}`,
      },
      track: `encoded_${identifier}`,
      userData: {},
    };
  }

  function createMockCandidate(title, artist, identifier, source, options = {}) {
    return {
      artist,
      title,
      identifier,
      duration: options.duration || 180000,
      source,
      track: createMockTrack(title, artist, identifier, options.duration, source.split("_")[0]),
      genres: options.genres || [],
      popularity: options.popularity || 50,
      releaseYear: options.releaseYear || 2023,
      features: options.features || null,
      score: 0,
      scoringDetails: [],
    };
  }

  describe("candidateScoring", () => {
    let scoreCandidates, getTimeOfDayFactor;

    beforeEach(() => {
      delete require.cache[require.resolve("../../../helpers/lavalink/candidateScoring")];
      delete require.cache[require.resolve("../../../helpers/lavalink/sessionProfile")];

      const candidateScoring = require("../../../helpers/lavalink/candidateScoring");
      scoreCandidates = candidateScoring.scoreCandidates;
      getTimeOfDayFactor = candidateScoring.getTimeOfDayFactor;
    });

    describe("Source Quality Scoring", () => {
      it("should give Deezer recommendations +40 points", () => {
        const candidates = [createMockCandidate("Song", "Artist", "id1", "deezer_recommendations")];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("source:+40(deezer)"));
        assert.ok(scored[0].score >= 90); // Base 50 + source 40
      });

      it("should give Spotify recommendations +35 points", () => {
        const candidates = [createMockCandidate("Song", "Artist", "id1", "spotify_recommendations")];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("source:+35(spotify)"));
      });

      it("should give YouTube Mix +15 points", () => {
        const candidates = [createMockCandidate("Song", "Artist", "id1", "youtube_mix")];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("source:+15(yt-mix)"));
      });

      it("should give YouTube Search +10 points", () => {
        const candidates = [createMockCandidate("Song", "Artist", "id1", "youtube_search")];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("source:+10(yt-search)"));
      });

      it("should give Top Artist Search +8 points", () => {
        const candidates = [createMockCandidate("Song", "Artist", "id1", "top_artist_search")];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("source:+8(top-artist)"));
      });

      it("should rank Deezer > Spotify > YouTube Mix > YouTube Search", () => {
        const candidates = [
          createMockCandidate("Song 1", "Artist", "id1", "youtube_search"),
          createMockCandidate("Song 2", "Artist", "id2", "deezer_recommendations"),
          createMockCandidate("Song 3", "Artist", "id3", "youtube_mix"),
          createMockCandidate("Song 4", "Artist", "id4", "spotify_recommendations"),
        ];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        // Verify order: Deezer, Spotify, YouTube Mix, YouTube Search
        assert.strictEqual(scored[0].source, "deezer_recommendations");
        assert.strictEqual(scored[1].source, "spotify_recommendations");
        assert.strictEqual(scored[2].source, "youtube_mix");
        assert.strictEqual(scored[3].source, "youtube_search");
      });
    });

    describe("Genre Matching", () => {
      it("should give +30 points per matching genre", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "deezer_recommendations", {
            genres: ["rock", "alternative"],
          }),
        ];
        const profile = createMinimalProfile({
          topGenres: [
            { genre: "rock", count: 5, weight: 1.0 },
            { genre: "alternative", count: 3, weight: 0.6 },
          ],
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        // Should have genre bonus (30 * 1.0) + (30 * 0.6) = 48
        const genreDetail = scored[0].scoringDetails.find((d) => d.startsWith("genre:"));
        assert.ok(genreDetail);
        assert.ok(scored[0].score > 90); // Base + source + genre
      });

      it("should penalize -25 for genre drift when no genres match", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "deezer_recommendations", {
            genres: ["electronic", "techno"],
          }),
        ];
        const profile = createMinimalProfile({
          topGenres: [
            { genre: "rock", count: 5, weight: 1.0 },
            { genre: "metal", count: 4, weight: 0.8 },
            { genre: "alternative", count: 3, weight: 0.6 },
          ],
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("genreDrift:-25"));
      });

      it("should handle partial genre matches", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "deezer_recommendations", {
            genres: ["indie rock"], // Contains "rock"
          }),
        ];
        const profile = createMinimalProfile({
          topGenres: [{ genre: "rock", count: 5, weight: 1.0 }],
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        // Partial match gives +15 * weight
        const genreDetail = scored[0].scoringDetails.find((d) => d.startsWith("genre:"));
        assert.ok(genreDetail);
      });
    });

    describe("Tempo/BPM Consistency", () => {
      it("should give +15 for tempo within 15 BPM", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { tempo: 125 },
          }),
        ];
        const profile = createMinimalProfile({ avgTempo: 120 }); // 5 BPM difference
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("tempo:+15"));
      });

      it("should give +8 for tempo within 30 BPM", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { tempo: 145 },
          }),
        ];
        const profile = createMinimalProfile({ avgTempo: 120 }); // 25 BPM difference
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("tempo:+8"));
      });

      it("should give -5 for tempo difference > 60 BPM", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { tempo: 200 },
          }),
        ];
        const profile = createMinimalProfile({ avgTempo: 120 }); // 80 BPM difference
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("tempo:-5"));
      });
    });

    describe("Artist Diversity", () => {
      it("should give +20 for new artist", () => {
        const candidates = [createMockCandidate("Song", "New Artist", "id1", "deezer_recommendations")];
        const profile = createMinimalProfile({
          topArtists: [
            { artist: "Artist A", count: 5 },
            { artist: "Artist B", count: 3 },
          ],
          lastThreeArtists: ["Artist A", "Artist B", "Artist C"],
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("diversity:+20(new-artist)"));
      });

      it("should give -40 for consecutive same artist", () => {
        const candidates = [createMockCandidate("Song", "Artist A", "id1", "deezer_recommendations")];
        const profile = createMinimalProfile({
          topArtists: [{ artist: "Artist A", count: 5 }],
          lastThreeArtists: ["Artist B", "Artist C", "Artist A"], // Artist A is last
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("diversity:-40(consecutive)"));
      });

      it("should apply vibe-based penalty for recent artist", () => {
        const candidates = [
          createMockCandidate("Song", "Artist A", "id1", "deezer_recommendations", {
            genres: ["rock"],
            features: { tempo: 120, energy: 0.7, valence: 0.6 },
          }),
        ];
        const profile = createMinimalProfile({
          topArtists: [{ artist: "Artist A", count: 3 }],
          lastThreeArtists: ["Artist A", "Artist B", "Artist C"], // Artist A in last 3 but not last
          topGenres: [{ genre: "rock", count: 5, weight: 1.0 }],
          avgTempo: 120,
          avgFeatures: { energy: 0.7, valence: 0.6 },
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        // Should have a diversity penalty (recent-good-vibe, recent-ok-vibe, or recent-bad-vibe)
        const diversityDetail = scored[0].scoringDetails.find((d) => d.includes("recent-"));
        assert.ok(diversityDetail);
      });
    });

    describe("Skip Learning", () => {
      it("should penalize -20 per artist skip", () => {
        const candidates = [createMockCandidate("Song", "Skipped Artist", "id1", "deezer_recommendations")];
        const profile = createMinimalProfile();
        const skipPatterns = {
          skippedArtists: { "Skipped Artist": 2 },
          skippedGenres: {},
        };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("skipArtist:-40")); // 2 * 20 = 40
      });

      it("should penalize -15 per genre skip", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "deezer_recommendations", {
            genres: ["skipped-genre"],
          }),
        ];
        const profile = createMinimalProfile();
        const skipPatterns = {
          skippedArtists: {},
          skippedGenres: { "skipped-genre": 1 },
        };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("skipGenre:-15"));
      });
    });

    describe("Duplicate Prevention", () => {
      it("should give -1000 for duplicate by identifier", () => {
        const candidates = [createMockCandidate("Song", "Artist", "duplicate-id", "deezer_recommendations")];
        const profile = createMinimalProfile({
          recentIdentifiers: ["duplicate-id", "other-id"],
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("duplicate:-1000(id)"));
        assert.strictEqual(scored[0].score, 0); // Clamped to 0
      });

      it("should detect duplicates by normalized title/artist", () => {
        const candidates = [
<<<<<<< HEAD
          createMockCandidate("Song Title (Official Video)", "Artist Name", "new-id", "deezer_recommendations"),
=======
          createMockCandidate(
            "Song Title (Official Video)",
            "Artist Name",
            "new-id",
            "deezer_recommendations"
          ),
>>>>>>> b1adc1d599ff252d5b2c968ebb9ffa2ae4241601
        ];
        const profile = createMinimalProfile({
          recentIdentifiers: ["other-id"],
          recentTracks: [
            createMockTrack("Song Title", "Artist Name", "old-id"), // Same song, different version
          ],
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("duplicate:-1000(title)"));
      });
    });

    describe("Time of Day Awareness", () => {
      it("should return correct time period", () => {
        const result = getTimeOfDayFactor();

        assert.ok(["morning", "afternoon", "evening", "night"].includes(result.period));
        assert.ok(typeof result.factor === "number");
        assert.ok(result.factor >= 0.4 && result.factor <= 0.75);
      });

      it("should give bonus for matching energy", () => {
        const timeOfDay = getTimeOfDayFactor();
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { energy: timeOfDay.factor }, // Perfect match
          }),
        ];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        const timeDetail = scored[0].scoringDetails.find((d) => d.startsWith("timeOfDay:"));
        assert.ok(timeDetail);
      });
    });

    describe("Popularity Weighting", () => {
      it("should give +10 for popularity 50-85", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            popularity: 70,
          }),
        ];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("popularity:+10"));
      });

      it("should give -5 for obscure tracks (popularity < 25)", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            popularity: 15,
          }),
        ];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("popularity:-5(obscure)"));
      });

      it("should give -3 for overplayed tracks (popularity > 95)", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            popularity: 98,
          }),
        ];
        const profile = createMinimalProfile();
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("popularity:-3(overplayed)"));
      });
    });

    describe("Energy Arc Management", () => {
      it("should give +15 for continuing energy build", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { energy: 0.9 },
          }),
        ];
        const profile = createMinimalProfile({
          energyTrend: "increasing",
          avgFeatures: { energy: 0.7 },
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("energyArc:+15(building)"));
      });

      it("should give +15 for continuing energy wind-down", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { energy: 0.4 },
          }),
        ];
        const profile = createMinimalProfile({
          energyTrend: "decreasing",
          avgFeatures: { energy: 0.6 },
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("energyArc:+15(winding)"));
      });

      it("should give +10 for maintaining stable energy", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { energy: 0.65 },
          }),
        ];
        const profile = createMinimalProfile({
          energyTrend: "stable",
          avgFeatures: { energy: 0.6 },
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("energyArc:+10(plateau)"));
      });
    });

    describe("Mood Progression", () => {
      it("should give +12 for continuing rising mood", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { valence: 0.8 },
          }),
        ];
        const profile = createMinimalProfile({
          valenceTrend: "increasing",
          avgFeatures: { valence: 0.6 },
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("mood:+12(rising)"));
      });

      it("should give +8 for maintaining stable mood", () => {
        const candidates = [
          createMockCandidate("Song", "Artist", "id1", "spotify_recommendations", {
            features: { valence: 0.55 },
          }),
        ];
        const profile = createMinimalProfile({
          valenceTrend: "stable",
          avgFeatures: { valence: 0.5 },
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        assert.ok(scored[0].scoringDetails.includes("mood:+8(stable)"));
      });
    });

    describe("Complex Scoring Scenarios", () => {
      it("should correctly rank a mix of candidates with various factors", () => {
        const candidates = [
          // Low quality source, no metadata
          createMockCandidate("Song 1", "New Artist", "id1", "youtube_search"),

          // High quality source, good genre match
          createMockCandidate("Song 2", "New Artist", "id2", "deezer_recommendations", {
            genres: ["rock"],
          }),

          // Medium source, perfect audio features
          createMockCandidate("Song 3", "New Artist", "id3", "spotify_recommendations", {
            genres: ["rock"],
            features: { tempo: 120, energy: 0.7, valence: 0.6 },
            popularity: 70,
          }),
        ];

        const profile = createMinimalProfile({
          topGenres: [{ genre: "rock", count: 5, weight: 1.0 }],
          avgTempo: 120,
          avgFeatures: { energy: 0.7, valence: 0.6 },
          energyTrend: "stable",
          valenceTrend: "stable",
        });
        const skipPatterns = { skippedArtists: {}, skippedGenres: {} };

        const scored = scoreCandidates(candidates, profile, skipPatterns, GUILD_ID);

        // Deezer with genre should be top due to source bonus + genre
        // Spotify with all features should be second
        // YouTube search should be last
        assert.strictEqual(scored[2].source, "youtube_search");
      });
    });
  });

  // Helper function to create minimal profile
  function createMinimalProfile(overrides = {}) {
    return {
      totalTracks: 5,
      topArtists: overrides.topArtists || [],
      artistCounts: overrides.artistCounts || {},
      topGenres: overrides.topGenres || [],
      recentIdentifiers: overrides.recentIdentifiers || [],
      recentTracks: overrides.recentTracks || [],
      lastThreeArtists: overrides.lastThreeArtists || [],
      avgDuration: overrides.avgDuration || 180000,
      avgTempo: overrides.avgTempo || null,
      avgFeatures: overrides.avgFeatures || null,
      energyTrend: overrides.energyTrend || null,
      valenceTrend: overrides.valenceTrend || null,
      guildId: GUILD_ID,
    };
  }
});

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
