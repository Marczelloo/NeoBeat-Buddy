const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  assertAutoplaySimulation,
  makeSimulationTrack,
  runAutoplaySimulation,
} = require("../../../helpers/lavalink/autoplaySimulator");

function seedTrack() {
  return makeSimulationTrack({
    title: "Neon Seed",
    artist: "Manual Listener",
    identifier: "manual-seed",
    genres: ["synthwave"],
    features: { tempo: 120, energy: 0.58, valence: 0.5, danceability: 0.7 },
  });
}

function candidate(title, artist, identifier, options = {}) {
  return {
    title,
    artist,
    identifier,
    source: options.source || "lastfm_similar",
    genres: options.genres || ["synthwave"],
    features: options.features || { tempo: 120, energy: 0.58, valence: 0.5, danceability: 0.7 },
    similarity: options.similarity ?? 0.8,
    duration: 180000,
    playable: options.playable !== false,
  };
}

describe("Autoplay simulator", () => {
  it("runs a long deterministic DJ session without duplicates, drift, or artist loops", () => {
    const artists = ["Neon Echo", "Pixel Bloom", "Chrome Fox", "Lunar Drift"];
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 40,
      seed: 42,
      manualSchedule: [
        {
          step: 16,
          track: makeSimulationTrack({
            title: "Manual Override",
            artist: "Manual Listener",
            identifier: "manual-override",
            genres: ["synthwave"],
            features: { tempo: 118, energy: 0.6, valence: 0.52, danceability: 0.68 },
          }),
        },
      ],
      candidateProvider: ({ step }) => {
        const artist = artists[(step - 1) % artists.length];
        return [
          candidate(`Neon Track ${step}`, artist, `neon-${step}`, { similarity: 0.82 }),
          candidate("Neon Seed", "Manual Listener", `mirror-${step}`, {
            source: "deezer_recommendations",
            similarity: 0.99,
          }),
          candidate(`Metal Detour ${step}`, "Wrong Lane", `metal-${step}`, {
            genres: ["metal"],
            similarity: 0.99,
            features: { tempo: 170, energy: 0.95, valence: 0.1, danceability: 0.25 },
          }),
        ];
      },
    });

    assertAutoplaySimulation(result);
    assert.equal(result.metrics.completedSteps, 40);
    assert.equal(result.metrics.unresolvedSteps, 0);
    assert.equal(result.metrics.duplicateSelections, 0);
    assert.equal(result.metrics.genreFamilyJumps, 0);
    assert.ok(result.metrics.resolutionFailures === 0);
  });

  it("continues through a failed provider resolution instead of declaring autoplay dead", () => {
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 3,
      candidateProvider: ({ step }) => [
        candidate(`Unavailable ${step}`, "Broken Provider", `broken-${step}`, { playable: false, similarity: 0.99 }),
        candidate(`Playable ${step}`, `Fallback Artist ${step}`, `playable-${step}`, { similarity: 0.78 }),
      ],
    });

    assertAutoplaySimulation(result);
    assert.equal(result.metrics.resolutionFailures, 3);
    assert.equal(result.metrics.unresolvedSteps, 0);
    assert.match(result.steps[0].selected.title, /^Playable/);
  });

  it("replays explicit candidate steps and reports unresolved cycles", () => {
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      replaySteps: [
        { candidates: [candidate("Replay one", "Replay Artist", "replay-1")] },
        { candidates: [candidate("Replay two", "Replay Artist Two", "replay-2")] },
        { candidates: [{ ...candidate("Provider outage", "Replay Artist", "replay-3"), playable: false }] },
      ],
      steps: 3,
      limits: { maxUnresolvedSteps: 1 },
    });

    assert.equal(result.passed, true);
    assert.equal(result.metrics.unresolvedSteps, 1);
    assert.equal(result.steps[2].selected, null);
  });
});
