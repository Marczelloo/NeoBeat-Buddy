const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  getFeatureCoverage,
  getTempoDistance,
  mergeAudioMetadata,
  deriveCatalogFeatureHints,
  normalizeDeezerMetadata,
} = require("../../../helpers/lavalink/autoplayMetadata");
const { scoreCandidates } = require("../../../helpers/lavalink/candidateScoring");
const { normalizeReleaseYear } = require("../../../helpers/lavalink/metadataValidation");

const noSkips = { skippedArtists: {}, skippedGenres: {} };

function candidate(title, artist, identifier, options = {}) {
  return {
    title,
    artist,
    identifier,
    duration: 180000,
    source: options.source || "lastfm_similar",
    genres: options.genres || ["pop", "rnb"],
    similarity: options.similarity ?? 0.8,
    features: options.features || null,
    metadataChecked: options.metadataChecked ?? true,
    metadataConfidence: options.metadataConfidence ?? 0.45,
  };
}

function profile(overrides = {}) {
  return {
    totalTracks: 4,
    artistCounts: {},
    topArtists: [],
    topGenres: [{ genre: "pop", count: 3, weight: 0.75 }, { genre: "rnb", count: 2, weight: 0.5 }],
    recentIdentifiers: [],
    cooldownTracks: [],
    recentTracks: [],
    recentAutoplayTracks: [],
    lastThreeArtists: [],
    avgDuration: 180000,
    avgTempo: 108,
    avgFeatures: { tempo: 108 },
    referenceGenres: ["pop", "rnb"],
    referenceGenreFamilies: ["pop", "rnb"],
    referenceFeatures: { tempo: 108 },
    recentGenreFamilies: ["pop", "pop", "rnb"],
    ...overrides,
  };
}

describe("Autoplay metadata without Spotify audio features", () => {
  it("derives low-confidence mood hints without pretending they are measured audio features", () => {
    const hints = deriveCatalogFeatureHints(
      candidate("Summer Dance", "Artist", "id", {
        genres: ["dance pop", "party"],
        features: { tempo: 124, loudness: -7 },
      })
    );

    assert.ok(hints.energy > 0.5 && hints.energy < 1);
    assert.ok(hints.valence > 0.5);
    assert.ok(hints.danceability > 0.4);
  });

  it("normalizes Deezer catalog fields without inventing mood features", () => {
    const metadata = normalizeDeezerMetadata({
      id: 123,
      bpm: 118.2,
      gain: -8.3,
      rank: 907086,
      isrc: "US123",
      release_date: "2021-05-20",
      track_position: 3,
      disk_number: 1,
      artist: { id: 7 },
      album: { id: 99, title: "Test Album" },
    });

    assert.deepStrictEqual(metadata.features, { tempo: 118.2, loudness: -8.3 });
    assert.strictEqual(metadata.deezerId, "123");
    assert.strictEqual(metadata.releaseYear, 2021);
    assert.strictEqual(metadata.metadataProvider, "deezer");
    assert.strictEqual(metadata.albumId, "99");
    assert.strictEqual(metadata.albumTitle, "Test Album");
    assert.strictEqual(metadata.trackPosition, 3);
    assert.strictEqual(getFeatureCoverage(metadata.features), 1);
  });

  it("compares half-time and double-time BPMs, but ignores invalid values", () => {
    assert.strictEqual(getTempoDistance(108, 112), 4);
    assert.strictEqual(getTempoDistance(108, 216), 0);
    assert.strictEqual(getTempoDistance(108, 0), null);
  });

  it("merges catalog tempo without overwriting richer existing metadata", () => {
    const track = candidate("Track", "Artist", "id", { features: { tempo: 108, energy: 0.7 } });
    mergeAudioMetadata(track, {
      deezerId: "42",
      features: { tempo: 112, loudness: -8 },
      metadataConfidence: 0.45,
      metadataProvider: "deezer",
    });

    assert.deepStrictEqual(track.features, { tempo: 108, energy: 0.7, loudness: -8 });
    assert.strictEqual(track.deezerId, "42");
    assert.strictEqual(track.metadataChecked, true);
  });

  it("rejects a large tempo jump even when Last.fm similarity is high", () => {
    const ranked = scoreCandidates(
      [
        candidate("Call It What You Want", "Taylor Swift", "taylor-call", {
          similarity: 1,
          features: { tempo: 163, loudness: -8 },
        }),
        candidate("Better Bridge", "Bridge Artist", "better-bridge", {
          similarity: 0.74,
          features: { tempo: 112, loudness: -8 },
        }),
      ],
      profile(),
      noSkips,
      "autoplay-metadata-regression"
    );

    assert.strictEqual(ranked[0].identifier, "better-bridge");
    assert.ok(ranked.find((item) => item.identifier === "taylor-call").scoringDetails.includes("continuity:-20(tempo)"));
  });

  it("penalizes a checked candidate with no audio anchor when the reference has one", () => {
    const [ranked] = scoreCandidates(
      [candidate("Unmeasured Track", "Artist", "unmeasured", { features: null, metadataChecked: true })],
      profile(),
      noSkips,
      "autoplay-metadata-confidence"
    );

    assert.ok(ranked.scoringDetails.includes("metadata:-12(no-tempo-anchor)"));
  });

  it("uses derived catalog energy only as a small tie-breaker", () => {
    const ranked = scoreCandidates(
      [
        candidate("Derived bridge", "Bridge Artist", "derived-bridge", {
          features: { tempo: 110 },
        }),
      ].map((item) => ({ ...item, derivedFeatures: { energy: 0.7, valence: 0.6 } })),
      profile({
        avgFeatures: { tempo: 108 },
        referenceFeatures: { tempo: 108 },
        referenceDerivedFeatures: { energy: 0.68, valence: 0.58 },
      }),
      noSkips,
      "autoplay-derived-feature-continuity"
    );

    assert.ok(ranked[0].scoringDetails.includes("continuity:+3(derived-energy)"));
    assert.ok(!ranked[0].scoringDetails.includes("continuity:+18(energy)"));
    assert.notStrictEqual(ranked[0].vibeConfidence, "low");
  });

  it("drops impossible release years before they enter the session profile", () => {
    const fixedNow = new Date("2026-08-13T00:00:00Z");
    assert.strictEqual(normalizeReleaseYear(1, fixedNow), null);
    assert.strictEqual(normalizeReleaseYear("1735-01-01", fixedNow), null);
    assert.strictEqual(normalizeReleaseYear("2024-05-10", fixedNow), 2024);
    assert.strictEqual(normalizeReleaseYear(2028, fixedNow), null);
  });
});
