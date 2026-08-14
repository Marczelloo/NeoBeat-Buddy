const assert = require("node:assert");
const { afterEach, beforeEach, describe, it } = require("node:test");

const {
  AI_DJ_SYSTEM_PROMPT,
  clearAIDJCacheForTests,
  rerankCandidatesWithAIDJ,
  setAIDJFetchForTests,
} = require("../../../helpers/lavalink/aiDj");

const envKeys = [
  "AI_DJ_ENABLED",
  "OPENAI_API_KEY",
  "AI_DJ_MODEL",
  "AI_DJ_REASONING_EFFORT",
  "AI_DJ_MIN_CONFIDENCE",
  "AI_DJ_CACHE_TTL_MS",
];
let savedEnvironment = {};

function track(title, artist, options = {}) {
  return {
    info: { title, author: artist, identifier: options.identifier || `${artist}-${title}` },
    userData: { genres: options.genres || ["hip hop"], albumTitle: options.albumTitle || null },
  };
}

function entry(title, artist, score, options = {}) {
  return {
    candidate: {
      title,
      artist,
      source: options.source || "lastfm_similar",
      genres: options.genres || ["hip hop"],
      albumTitle: options.albumTitle || null,
      similarity: options.similarity ?? 0.8,
    },
    score,
    details: {
      relation: 40,
      genreScore: 30,
      sameArtist: Boolean(options.sameArtist),
      sameAlbum: Boolean(options.sameAlbum),
    },
  };
}

function input(ranked) {
  return {
    guildId: "ai-dj-test",
    anchorTrack: track("Frascati", "Taco Hemingway", { albumTitle: "Frascati" }),
    referenceTrack: track("Nostalgia", "Taco Hemingway", { albumTitle: "Frascati" }),
    profile: { recentTracks: [], pendingManualTracks: [] },
    context: { anchorFamilies: ["hiphop"], referenceFamilies: ["hiphop"], artistStreak: 1, albumStreak: 1 },
    ranked,
  };
}

describe("AI DJ reranker", () => {
  beforeEach(() => {
    savedEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    process.env.AI_DJ_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_DJ_MODEL = "gpt-5.6-terra";
    process.env.AI_DJ_REASONING_EFFORT = "low";
    process.env.AI_DJ_MIN_CONFIDENCE = "0.55";
    process.env.AI_DJ_CACHE_TTL_MS = "300000";
    clearAIDJCacheForTests();
    setAIDJFetchForTests(null);
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnvironment[key];
    }
    clearAIDJCacheForTests();
    setAIDJFetchForTests(null);
  });

  it("uses strict structured output and promotes only a supplied candidate", async () => {
    let request;
    setAIDJFetchForTests(async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            decision: "select",
            candidateId: "c2",
            confidence: 0.91,
            transitionScore: 88,
            baselineDelta: 14,
            reasons: ["Stronger continuity with the manual anchor."],
          }),
        }),
      };
    });

    const result = await rerankCandidatesWithAIDJ(input([
      entry("Safe First", "Artist One", 80),
      entry("Best Transition", "Artist Two", 76),
    ]));

    assert.strictEqual(result.status, "selected");
    assert.strictEqual(result.ranked[0].candidate.title, "Best Transition");
    assert.strictEqual(result.ranked.filter((candidate) => candidate.candidate.title === "Best Transition").length, 1);
    assert.strictEqual(request.model, "gpt-5.6-terra");
    assert.strictEqual(request.reasoning.effort, "low");
    assert.strictEqual(request.store, false);
    assert.strictEqual(request.text.format.type, "json_schema");
    assert.strictEqual(request.text.format.strict, true);
    assert.match(request.input[0].content[0].text, /MewBit AI DJ/);
    assert.match(AI_DJ_SYSTEM_PROMPT, /must never invent/);
    assert.strictEqual(request.input[1].content[0].text.includes("deterministicScore"), false);
  });

  it("rejects an invented candidate and preserves deterministic V3 order", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          decision: "select",
            candidateId: "made-up-track",
            confidence: 0.99,
            transitionScore: 99,
            baselineDelta: 99,
            reasons: ["Nope"],
        }),
      }),
    }));

    const result = await rerankCandidatesWithAIDJ(input([entry("Deterministic Winner", "Artist One", 80)]));

    assert.strictEqual(result.status, "fallback-error");
    assert.strictEqual(result.ranked[0].candidate.title, "Deterministic Winner");
  });

  it("keeps V3 order for a low-confidence decision", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          decision: "select",
            candidateId: "c2",
            confidence: 0.2,
            transitionScore: 61,
            baselineDelta: 20,
            reasons: ["Weak evidence"],
        }),
      }),
    }));

    const result = await rerankCandidatesWithAIDJ(input([
      entry("Deterministic Winner", "Artist One", 80),
      entry("Uncertain Option", "Artist Two", 76),
    ]));

    assert.strictEqual(result.status, "low-confidence");
    assert.strictEqual(result.ranked[0].candidate.title, "Deterministic Winner");
  });

  it("caches an identical listening context", async () => {
    let calls = 0;
    setAIDJFetchForTests(async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            decision: "select",
            candidateId: "c1",
            confidence: 0.8,
            transitionScore: 80,
            baselineDelta: 0,
            reasons: ["Reliable direct relation"],
          }),
        }),
      };
    });

    const payload = input([entry("Cached Choice", "Artist One", 80)]);
    const first = await rerankCandidatesWithAIDJ(payload);
    const second = await rerankCandidatesWithAIDJ(payload);

    assert.strictEqual(calls, 1);
    assert.strictEqual(first.cached, false);
    assert.strictEqual(second.cached, true);
  });

  it("keeps V3's first candidate when AI confirms the baseline", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          decision: "select",
          candidateId: "c1",
          confidence: 0.94,
          transitionScore: 89,
          baselineDelta: 0,
          reasons: ["The baseline has the strongest direct relationship."],
        }),
      }),
    }));

    const result = await rerankCandidatesWithAIDJ(input([
      entry("Deterministic Winner", "Artist One", 80),
      entry("Alternative", "Artist Two", 76),
    ]));

    assert.strictEqual(result.status, "baseline-confirmed");
    assert.strictEqual(result.ranked[0].candidate.title, "Deterministic Winner");
  });

  it("rejects an AI promotion without a material baseline advantage", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          decision: "select",
          candidateId: "c2",
          confidence: 0.96,
          transitionScore: 90,
          baselineDelta: 3,
          reasons: ["Only a minor difference from the baseline."],
        }),
      }),
    }));

    const result = await rerankCandidatesWithAIDJ(input([
      entry("Deterministic Winner", "Artist One", 80),
      entry("Weakly Better", "Artist Two", 76),
    ]));

    assert.strictEqual(result.status, "baseline-not-beaten");
    assert.strictEqual(result.ranked[0].candidate.title, "Deterministic Winner");
  });
});
