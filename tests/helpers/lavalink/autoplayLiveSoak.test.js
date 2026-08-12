const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { evaluateLiveSoak, resolveSeedTrack } = require("../../../helpers/lavalink/autoplayLiveSoak");

function resultWith(metrics) {
  return { metrics, steps: [] };
}

describe("Live autoplay soak acceptance", () => {
  it("uses the same ranked seed choice as normal playback instead of Lavalink's first raw result", async () => {
    const poru = {
      resolve: async () => ({
        tracks: [
          { info: { title: "Tamagotchi (Nightcore)", author: "Tużera", identifier: "wrong", length: 180000 } },
          { info: { title: "Tamagotchi", author: "TACONAFIDE", identifier: "right", length: 180000 } },
        ],
      }),
    };

    const selected = await resolveSeedTrack(poru, "Taconafide - Tamagotchi");
    assert.equal(selected.info.identifier, "right");
  });

  it("accepts a clean real-pipeline result", () => {
    const result = evaluateLiveSoak(
      resultWith({
        duplicateSelections: 0,
        genreFamilyJumps: 0,
        maxConsecutiveArtist: 2,
        artistWindowViolations: 0,
        unresolvedSteps: 0,
      })
    );

    assert.equal(result.passed, true);
    assert.deepEqual(result.violations, []);
  });

  it("fails when real-cycle quality limits are exceeded", () => {
    const result = evaluateLiveSoak(
      resultWith({
        duplicateSelections: 1,
        genreFamilyJumps: 1,
        maxConsecutiveArtist: 3,
        artistWindowViolations: 1,
        unresolvedSteps: 1,
      })
    );

    assert.equal(result.passed, false);
    assert.deepEqual(result.violations, [
      "duplicates=1",
      "genreJumps=1",
      "maxArtistStreak=3",
      "artistWindow=1",
      "unresolved=1",
    ]);
  });

  it("fails a live run that exceeds verified continuity limits", () => {
    const result = evaluateLiveSoak(
      resultWith({
        duplicateSelections: 0,
        genreFamilyJumps: 0,
        maxConsecutiveArtist: 1,
        artistWindowViolations: 0,
        unresolvedSteps: 0,
        continuity: {
          tempo: { samples: 2, average: 42, max: 56 },
          energy: { samples: 2, average: 0.2, max: 0.52 },
          valence: { samples: 2, average: 0.1, max: 0.2 },
          averageBridgeStrength: 1.5,
        },
      })
    );

    assert.strictEqual(result.passed, false);
    assert.deepStrictEqual(result.violations, ["tempoJump=56", "energyJump=0.52"]);
  });
});
