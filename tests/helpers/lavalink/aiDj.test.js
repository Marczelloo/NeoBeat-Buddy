const assert = require("node:assert");
const { afterEach, beforeEach, describe, it } = require("node:test");

const {
  AI_DJ_DIRECTOR_SYSTEM_PROMPT,
  clearAIDJCacheForTests,
  filterPlanRepeats,
  planNextTrackWithAIDJ,
  setAIDJFetchForTests,
} = require("../../../helpers/lavalink/aiDj");

const envKeys = [
  "AI_DJ_ENABLED",
  "OPENAI_API_KEY",
  "AI_DJ_MODEL",
  "AI_DJ_REASONING_EFFORT",
  "AI_DJ_MIN_CONFIDENCE",
  "AI_DJ_MIN_TOP_FIT",
  "AI_DJ_CACHE_TTL_MS",
  "AI_DJ_WEB_SEARCH",
  "AI_DJ_MAX_PROPOSALS",
];
let savedEnvironment = {};

function track(title, artist, options = {}) {
  return {
    info: { title, author: artist, identifier: options.identifier || `${artist}-${title}` },
    userData: { genres: options.genres || ["hip hop"], albumTitle: options.albumTitle || null },
  };
}

function input() {
  return {
    guildId: "ai-dj-test",
    anchorTrack: track("Frascati", "Taco Hemingway", { albumTitle: "Frascati" }),
    referenceTrack: track("Nostalgia", "Taco Hemingway", { albumTitle: "Frascati" }),
    profile: {
      recentTracks: [], manualHistory: [], pendingManualTracks: [], manualTasteGenres: [], manualTasteGenreFamilies: [],
      verifiedCatalogCandidates: [{ artist: "Taco Hemingway", title: "Wosk", albumTitle: "Frascati", source: "same_album", genres: ["hip hop"] }],
    },
    context: { anchorFamilies: ["hiphop"], referenceFamilies: ["hiphop"], artistStreak: 1, albumStreak: 1, skippedArtists: new Set() },
  };
}

function plannedResponse(candidates = [{ artist: "Taco Hemingway", title: "Wosk", album: "Frascati", fit: 96, reason: "Direct album continuation." }]) {
  return {
    decision: "propose",
    confidence: 0.9,
    direction: { summary: "Stay in Frascati's intimate Warsaw rap lane.", energy: "steady-mid", mood: "late-night, reflective" },
    candidates,
    reasons: ["Manual anchor and current cut both favour reflective Polish rap."],
  };
}

describe("AI DJ director", () => {
  beforeEach(() => {
    savedEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    process.env.AI_DJ_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_DJ_MODEL = "gpt-5.6-luna";
    process.env.AI_DJ_REASONING_EFFORT = "low";
    process.env.AI_DJ_MIN_CONFIDENCE = "0.55";
    process.env.AI_DJ_MIN_TOP_FIT = "68";
    process.env.AI_DJ_CACHE_TTL_MS = "300000";
    process.env.AI_DJ_WEB_SEARCH = "true";
    process.env.AI_DJ_MAX_PROPOSALS = "8";
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

  it("uses structured output and web-grounded music direction", async () => {
    let request;
    setAIDJFetchForTests(async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ output_text: JSON.stringify(plannedResponse()) }) };
    });

    const result = await planNextTrackWithAIDJ(input());

    assert.strictEqual(result.status, "planned");
    assert.strictEqual(result.plan.candidates[0].title, "Wosk");
    assert.strictEqual(request.model, "gpt-5.6-luna");
    assert.strictEqual(request.store, false);
    assert.strictEqual(request.tools[0].type, "web_search");
    assert.strictEqual(request.tool_choice, "required");
    assert.strictEqual(request.text.format.name, "mewbit_ai_dj_plan");
    assert.match(request.input[0].content[0].text, /music director/);
    assert.match(AI_DJ_DIRECTOR_SYSTEM_PROMPT, /web search is available/);
    assert.match(AI_DJ_DIRECTOR_SYSTEM_PROMPT, /durable taste map/);
    assert.match(request.input[1].content[0].text, /verifiedCatalog/);
  });

  it("caches an identical listening context", async () => {
    let calls = 0;
    setAIDJFetchForTests(async () => {
      calls += 1;
      return { ok: true, json: async () => ({ output_text: JSON.stringify(plannedResponse()) }) };
    });

    const first = await planNextTrackWithAIDJ(input());
    const second = await planNextTrackWithAIDJ(input());

    assert.strictEqual(calls, 1);
    assert.strictEqual(first.cached, false);
    assert.strictEqual(second.cached, true);
  });

  it("does not invoke a paid web search unless explicitly enabled", async () => {
    process.env.AI_DJ_WEB_SEARCH = "false";
    let request;
    setAIDJFetchForTests(async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ output_text: JSON.stringify(plannedResponse()) }) };
    });

    const result = await planNextTrackWithAIDJ(input());

    assert.strictEqual(result.status, "planned");
    assert.strictEqual(request.tools, undefined);
    assert.strictEqual(request.tool_choice, undefined);
  });

  it("passes the AI-specific diversity thresholds to the director", async () => {
    let request;
    setAIDJFetchForTests(async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ output_text: JSON.stringify(plannedResponse()) }) };
    });

    const directorInput = input();
    directorInput.context = {
      ...directorInput.context,
      softArtistExitStreak: 4,
      softAlbumExitStreak: 3,
      aiDiversityArtistStreak: 3,
      aiDiversityAlbumStreak: 2,
    };
    await planNextTrackWithAIDJ(directorInput);

    const prompt = JSON.parse(request.input[1].content[0].text);
    assert.strictEqual(prompt.constraints.softArtistExitAfter, 3);
    assert.strictEqual(prompt.constraints.softAlbumExitAfter, 2);
  });

  it("deduplicates proposals and falls back if the plan is unsafe or invalid", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(plannedResponse([
        { artist: "Artist", title: "Track", album: "", fit: 88, reason: "Fit" },
        { artist: "Artist", title: "Track", album: "", fit: 84, reason: "Duplicate" },
      ])) }),
    }));
    const result = await planNextTrackWithAIDJ(input());
    assert.strictEqual(result.status, "planned");
    assert.strictEqual(result.plan.candidates.length, 1);

    clearAIDJCacheForTests();
    setAIDJFetchForTests(async () => ({ ok: true, json: async () => ({ output_text: "not-json" }) }));
    const fallback = await planNextTrackWithAIDJ(input());
    assert.strictEqual(fallback.status, "fallback-error");
  });

  it("removes a current or short-session repeat from an otherwise valid AI plan", () => {
    const repeated = track("Nostalgia", "Taco Hemingway", { albumTitle: "Frascati" });
    repeated.userData.autoplayPlayedAt = Date.now() - 1000;
    const plan = plannedResponse([
      { artist: "Taco Hemingway", title: "Nostalgia", album: "Frascati", fit: 96, reason: "Repeat." },
      { artist: "Taco Hemingway", title: "Wosk", album: "Frascati", fit: 94, reason: "Continue." },
    ]);

    const filtered = filterPlanRepeats(plan, {
      ...input(),
      referenceTrack: repeated,
      profile: { cooldownTracks: [repeated], recentTracks: [], manualHistory: [] },
      context: { repeatCooldownMs: 60 * 60 * 1000 },
    });

    assert.deepStrictEqual(filtered.candidates.map((candidate) => candidate.title), ["Wosk"]);
  });

  it("requires an explicit bounded transition-fit score from the director", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(plannedResponse([
        { artist: "Taco Hemingway", title: "Wosk", album: "Frascati", fit: 101, reason: "Invalid score." },
      ])) }),
    }));

    const result = await planNextTrackWithAIDJ(input());
    assert.strictEqual(result.status, "fallback-error");
  });

  it("uses V3 when the AI has no genuinely strong next-track proposal", async () => {
    setAIDJFetchForTests(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(plannedResponse([
        { artist: "Taco Hemingway", title: "Wosk", album: "Frascati", fit: 67, reason: "Too weak for director control." },
      ])) }),
    }));

    const result = await planNextTrackWithAIDJ(input());
    assert.strictEqual(result.status, "low-fit");
  });
});
