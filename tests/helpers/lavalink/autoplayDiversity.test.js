const assert = require("node:assert");
const { describe, it } = require("node:test");

const { getExposureKey } = require("../../../helpers/lavalink/autoplayExposure");
const {
  getAutoplayExposurePenalty,
  scoreCandidates,
} = require("../../../helpers/lavalink/candidateScoring");
const {
  getTransitionQuality,
  getDiversifiedResolutionOrder,
  mergeCandidates,
} = require("../../../helpers/lavalink/smartAutoplay");

const noSkips = { skippedArtists: {}, skippedGenres: {} };

function candidate(title, artist, identifier, score = 0) {
  return {
    title,
    artist,
    identifier,
    source: "lastfm_similar",
    genres: ["pop"],
    similarity: 0.8,
    score,
    hardRejected: false,
    deferred: false,
  };
}

function profile(overrides = {}) {
  return {
    artistCounts: {},
    topArtists: [],
    topGenres: [],
    recentIdentifiers: [],
    cooldownTracks: [],
    recentTracks: [],
    recentAutoplayTracks: [],
    lastThreeArtists: [],
    referenceGenres: ["pop"],
    referenceGenreFamilies: ["pop"],
    referenceFeatures: null,
    recentGenreFamilies: ["pop"],
    autoplayReferenceKey: getExposureKey({ artist: "Seed Artist", title: "Seed Song" }),
    autoplayExposure: { ttlMs: 14 * 24 * 60 * 60 * 1000, tracks: [], transitions: [] },
    ...overrides,
  };
}

describe("Autoplay diversity", () => {
  it("uses canonical artist/title identity when merging provider candidates", () => {
    const merged = mergeCandidates([
      candidate("Borderline", "Tame Impala", "youtube-id"),
      candidate("Borderline", "Tame Impala", "deezer-id"),
    ]);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].identifier, "youtube-id");
  });

  it("penalizes a previously exposed track and repeated seed transition", () => {
    const now = Date.now();
    const trackKey = getExposureKey({ artist: "New Artist", title: "Known Song" });
    const referenceKey = getExposureKey({ artist: "Seed Artist", title: "Seed Song" });
    const transitionKey = `${referenceKey}=>${trackKey}`;
    const currentProfile = profile({
      autoplayExposure: {
        ttlMs: 14 * 24 * 60 * 60 * 1000,
        tracks: [{ key: trackKey, count: 2, lastSeen: now }],
        transitions: [{ key: transitionKey, count: 1, lastSeen: now }],
      },
    });

    const exposure = getAutoplayExposurePenalty(candidate("Known Song", "New Artist", "known"), currentProfile, now);
    assert.ok(exposure.penalty >= 20);

    const ranked = scoreCandidates(
      [
        candidate("Known Song", "New Artist", "known"),
        candidate("Fresh Song", "Fresh Artist", "fresh"),
      ],
      currentProfile,
      noSkips,
      "autoplay-diversity-test"
    );

    assert.strictEqual(ranked[0].identifier, "fresh");
    assert.ok(ranked[1].scoringDetails.some((detail) => detail.startsWith("exposure:-")));
  });

  it("keeps weighted exploration inside the near-top safety band", () => {
    const ranked = [
      candidate("Top", "Artist A", "top", 100),
      candidate("Close", "Artist B", "close", 96),
      candidate("Close Two", "Artist C", "close-two", 92),
      candidate("Too Weak", "Artist D", "weak", 60),
    ];

    const selectedWithTopRoll = getDiversifiedResolutionOrder(ranked, () => 0)[0];
    const selectedWithExplorationRoll = getDiversifiedResolutionOrder(ranked, () => 0.999999)[0];

    assert.strictEqual(selectedWithTopRoll.identifier, "top");
    assert.strictEqual(selectedWithExplorationRoll.identifier, "close");
    assert.notStrictEqual(selectedWithExplorationRoll.identifier, "weak");
  });

  it("does not let a materially weaker candidate win without a better transition anchor", () => {
    const ranked = [
      { ...candidate("Top", "Artist A", "top", 100), transitionQuality: 4 },
      { ...candidate("Weak", "Artist B", "weak", 94), transitionQuality: 1 },
      { ...candidate("Bridge", "Artist C", "bridge", 94), transitionQuality: 8 },
    ];

    const selected = getDiversifiedResolutionOrder(ranked, () => 0.999999)[0];

    assert.strictEqual(selected.identifier, "bridge");
    assert.strictEqual(getTransitionQuality(ranked[2], profile()), 3);
  });
});
