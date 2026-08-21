const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  evaluateAutoplaySimulation,
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

function catalogCandidate(title, artist, identifier, options = {}) {
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

function proposal(title, artist, options = {}) {
  return {
    artist,
    title,
    album: options.album || "",
    lane: options.lane || "continuation",
    fit: options.fit ?? 90,
    energy: options.energy ?? 55,
    mood: options.mood || "neon night drive",
    reason: options.reason || "Fits the room.",
    rank: options.rank ?? 0,
  };
}

describe("Autoplay simulator (AI-first)", () => {
  it("lets a distinctive-artist chapter run long without code-level caps or duplicates", () => {
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 12,
      seed: 42,
      candidateProvider: ({ step }) => [
        // Verified catalog mirrors what providers would return for the plan.
        ...[1, 2, 3].map((n) => catalogCandidate(`Taco Cut ${step}-${n}`, "Taco Hemingway", `taco-${step}-${n}`, { source: "same_album" })),
      ],
      aiPlanner: ({ step }) => ({
        status: "planned",
        model: "simulation",
        plan: {
          decision: "propose",
          confidence: 0.9,
          direction: { summary: "Stay in Taco's Warsaw lane.", energy: "mid", mood: "reflective" },
          reasons: ["The room chose this lane."],
          candidates: [
            proposal(`Taco Cut ${step}-2`, "Taco Hemingway", { fit: 93 }),
            proposal(`Taco Cut ${step}-1`, "Taco Hemingway", { fit: 91, rank: 1 }),
            proposal("Outside Bridge", "Quebonafide", { fit: 62, lane: "bridge", rank: 2 }),
          ],
        },
      }),
    });

    assert.equal(result.passed, true, result.violations.join("; "));
    assert.equal(result.metrics.completedSteps, 12);
    assert.equal(result.metrics.unresolvedSteps, 0);
    assert.equal(result.metrics.duplicateSelections, 0);
    assert.equal(result.metrics.aiDirectedSelections, 12);
    // A distinctive artist may carry a long, intentional chapter.
    assert.ok(result.metrics.maxConsecutiveArtist >= 10, `streak=${result.metrics.maxConsecutiveArtist}`);
    assert.equal(result.metrics.laneCounts.continuation, 12);
  });

  it("follows the director's ordering and rotates through a strong bridge", () => {
    let step = 0;
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 6,
      seed: 7,
      candidateProvider: ({ step: currentStep }) => [
        catalogCandidate(`Continuation ${currentStep}`, "Taco Hemingway", `cont-${currentStep}`),
        catalogCandidate(`Bridge ${currentStep}`, `Bridge Artist ${currentStep % 3}`, `bridge-${currentStep}`),
      ],
      aiPlanner: () => {
        step += 1;
        // After a while the director prefers a well-rated bridge over a
        // weaker continuation - fit order decides.
        const preferBridge = step > 3;
        return {
          status: "planned",
          model: "simulation",
          plan: {
            decision: "propose",
            confidence: 0.9,
            direction: { summary: "Rotate out.", energy: "mid", mood: "upbeat" },
            reasons: ["Run felt complete."],
            candidates: preferBridge
              ? [
                  proposal(`Bridge ${step}`, "Bridge Artist X", { fit: 92, lane: "bridge" }),
                  proposal(`Continuation ${step}`, "Taco Hemingway", { fit: 74, rank: 1 }),
                ]
              : [
                  proposal(`Continuation ${step}`, "Taco Hemingway", { fit: 92 }),
                  proposal(`Bridge ${step}`, "Bridge Artist X", { fit: 74, lane: "bridge", rank: 1 }),
                ],
          },
        };
      },
    });

    assert.equal(result.passed, true, result.violations.join("; "));
    assert.equal(result.metrics.aiDirectedSelections, 6);
    assert.ok(result.metrics.laneCounts.bridge >= 3);
    assert.ok(result.metrics.laneCounts.continuation >= 3);
    // The generic-style rotation kept any single artist short.
    assert.ok(result.metrics.maxConsecutiveArtist <= 4, `streak=${result.metrics.maxConsecutiveArtist}`);
  });

  it("falls back to the deterministic ladder when the director returns null", () => {
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 4,
      seed: 11,
      candidateProvider: ({ step }) => [
        catalogCandidate(`Neon Track ${step}`, `Fresh Artist ${step}`, `fresh-${step}`, { similarity: 0.82 }),
        catalogCandidate("Neon Seed", "Manual Listener", `mirror-${step}`, {
          source: "deezer_recommendations",
          similarity: 0.99,
        }),
      ],
      aiPlanner: () => null,
    });

    assert.equal(result.passed, true, result.violations.join("; "));
    assert.equal(result.metrics.fallbackLadderSelections, 4);
    assert.equal(result.metrics.aiDirectedSelections, 0);
    assert.equal(result.metrics.duplicateSelections, 0);
  });

  it("drops below-minimum-fit proposals per candidate and still plays the session", () => {
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 3,
      seed: 5,
      minFit: 60,
      candidateProvider: ({ step }) => [
        catalogCandidate(`Ladder Pick ${step}`, `Ladder Artist ${step}`, `ladder-${step}`, { similarity: 0.8 }),
      ],
      aiPlanner: ({ step }) => ({
        status: "planned",
        model: "simulation",
        plan: {
          decision: "propose",
          confidence: 0.9,
          direction: { summary: "Weak plan.", energy: "mid", mood: "meh" },
          reasons: ["Only weak options."],
          candidates: [proposal(`Weak Proposal ${step}`, "Weak Artist", { fit: 40 })],
        },
      }),
    });

    assert.equal(result.passed, true, result.violations.join("; "));
    assert.equal(result.metrics.lowFitDrops, 3);
    assert.equal(result.metrics.fallbackLadderSelections, 3);
  });

  it("reports unresolved cycles when every provider resolution fails", () => {
    const result = runAutoplaySimulation({
      seedTrack: seedTrack(),
      steps: 3,
      candidateProvider: ({ step }) => [
        catalogCandidate(`Broken ${step}`, "Broken Provider", `broken-${step}`, { playable: false, similarity: 0.99 }),
      ],
      aiPlanner: ({ step }) => ({
        status: "planned",
        model: "simulation",
        plan: {
          decision: "propose",
          confidence: 0.9,
          direction: { summary: "Try.", energy: "mid", mood: "calm" },
          reasons: ["Attempt."],
          candidates: [proposal(`Broken ${step}`, "Broken Provider", { fit: 95 })],
        },
      }),
    });

    const evaluated = evaluateAutoplaySimulation(result, { maxUnresolvedSteps: 3 });
    assert.equal(evaluated.passed, true);
    assert.equal(evaluated.metrics.unresolvedSteps, 3);
    assert.equal(evaluated.steps[0].selected, null);
  });
});
