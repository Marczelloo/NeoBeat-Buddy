const assert = require("node:assert");
const { describe, it } = require("node:test");
const { scoreCandidates } = require("../../../helpers/lavalink/candidateScoring");
const {
  areGenreFamiliesCompatible,
  getGenreFamilies,
} = require("../../../helpers/lavalink/genreUtils");

describe("Autoplay genre continuity", () => {
  it("classifies related genres into stable families", () => {
    assert.deepStrictEqual(getGenreFamilies(["trap", "cloud rap"]), ["hiphop"]);
    assert.deepStrictEqual(getGenreFamilies(["alternative rock", "indie rock"]), ["rock"]);
    assert.strictEqual(areGenreFamiliesCompatible(["hiphop"], ["metal"]), false);
    assert.strictEqual(areGenreFamiliesCompatible(["hiphop"], ["rnb"]), true);
  });

  it("hard-rejects a known incompatible transition from the current track", () => {
    const candidates = [
      {
        artist: "Metal Artist",
        title: "Heavy Track",
        identifier: "metal-1",
        source: "deezer_recommendations",
        duration: 180000,
        genres: ["metalcore"],
        features: { tempo: 150, energy: 0.95, valence: 0.2 },
      },
      {
        artist: "Rap Artist",
        title: "Smooth Track",
        identifier: "rap-1",
        source: "spotify_recommendations",
        duration: 180000,
        genres: ["hip hop"],
        features: { tempo: 96, energy: 0.7, valence: 0.55 },
      },
    ];

    const scored = scoreCandidates(
      candidates,
      {
        totalTracks: 4,
        artistCounts: {},
        topArtists: [],
        topGenres: [{ genre: "hip hop", count: 4, weight: 1 }],
        recentIdentifiers: [],
        recentTracks: [],
        lastThreeArtists: [],
        avgDuration: 180000,
        avgTempo: 96,
        avgFeatures: { energy: 0.7, valence: 0.55 },
        energyTrend: "stable",
        valenceTrend: "stable",
        referenceGenres: ["hip hop"],
        referenceGenreFamilies: ["hiphop"],
        referenceFeatures: { tempo: 96, energy: 0.7, valence: 0.55 },
        recentGenreFamilies: ["hiphop", "hiphop", "hiphop"],
      },
      { skippedArtists: {}, skippedGenres: {} },
      "genre-continuity-test"
    );

    assert.strictEqual(scored.find((candidate) => candidate.identifier === "metal-1").hardRejected, true);
    assert.strictEqual(scored.find((candidate) => candidate.identifier === "rap-1").hardRejected, false);
  });
});
