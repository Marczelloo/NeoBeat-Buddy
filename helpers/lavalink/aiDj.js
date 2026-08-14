const crypto = require("node:crypto");
const Log = require("../logs/log");
const { getTrackMetadata } = require("./sessionProfile");
const { getTrackIdentityKeys } = require("./trackIdentity");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING_EFFORT = "low";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_PROPOSALS = 8;
const DEFAULT_MIN_CONFIDENCE = 0.55;
const CACHE_LIMIT = 300;
const REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);

const AI_DJ_DIRECTOR_SYSTEM_PROMPT = `You are MewBit AI DJ, the music director for a shared Discord listening room.

Choose the next songs yourself. The current song decides the immediate transition; the manual anchor and the manual listening history define the session's identity. The supplied manual memory is the room's durable taste map: it contains music listeners deliberately chose earlier, plus their recurring artists and albums. Treat it as more important than autoplay history. Never let a session drift merely because recent tracks share a broad label such as "hip hop" or "pop". A transition must make musical and cultural sense to a listener, not merely share a genre tag.

Return 4 to 8 specific, real recordings in deliberate priority order. Prefer the supplied verified catalog whenever it contains a good fit: those recordings are already playable through MewBit's providers. You may include up to two open-catalog discoveries if the verified pool misses the best musical continuation. Prefer, in order: a natural continuation from the same album or artist when it still fits; a return to a compatible artist or album from manual memory; a close collaborator, scene, or sonic peer; then a measured bridge. When the supplied soft-exit thresholds have been reached, put one or more equally credible artist/album exits near the top: collaborators, a shared scene, a compatible remembered artist, or a measured bridge. Do not force a low-quality exit merely to add variety; a clearly stronger continuation may stay first. Leaving an album does not ban returning to it later if the transition remains natural. Do not propose remixes, covers, live cuts, sped-up/slowed versions, karaoke, or duplicate recordings unless the current lane explicitly is that version style.

When web search is available, use it to verify exact artist/title pairs when your knowledge is uncertain, especially for niche, regional, or non-English music. Never output a vague genre, playlist, album-only recommendation, invented track, or a different version of an existing song. Avoid every supplied recent/blocked recording. A recording may only repeat after the supplied repeat cooldown has elapsed; within that cooldown, choose another fitting cut. If a credible direction cannot be formed, return "no_match" instead of guessing.

The bot will independently resolve every proposal with music providers and reject anything that is unavailable, misidentified, duplicated, skipped, or an incompatible version. Keep reasons compact and describe the transition, not generic praise.`;

const AI_DJ_DIRECTOR_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "direction", "confidence", "candidates", "reasons"],
  properties: {
    decision: { type: "string", enum: ["propose", "no_match"] },
    direction: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "energy", "mood"],
      properties: {
        summary: { type: "string" },
        energy: { type: "string" },
        mood: { type: "string" },
      },
    },
    confidence: { type: "number" },
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["artist", "title", "album", "reason"],
        properties: {
          artist: { type: "string" },
          title: { type: "string" },
          album: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    reasons: { type: "array", items: { type: "string" } },
  },
};

const decisionCache = new Map();
let fetchForTests = null;

function readPositiveNumber(value, fallback, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function readReasoningEffort(value) {
  const normalized = String(value || DEFAULT_REASONING_EFFORT).trim().toLowerCase();
  return REASONING_EFFORTS.has(normalized) ? normalized : DEFAULT_REASONING_EFFORT;
}

function getConfig() {
  return {
    enabled: process.env.AI_DJ_ENABLED === "true",
    apiKey: String(process.env.OPENAI_API_KEY || "").trim(),
    model: String(process.env.AI_DJ_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    reasoningEffort: readReasoningEffort(process.env.AI_DJ_REASONING_EFFORT),
    timeoutMs: readPositiveNumber(process.env.AI_DJ_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, { min: 500, max: 15000 }),
    cacheTtlMs: readPositiveNumber(process.env.AI_DJ_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS, { min: 0, max: 60 * 60 * 1000 }),
    maxProposals: Math.floor(readPositiveNumber(process.env.AI_DJ_MAX_PROPOSALS, DEFAULT_MAX_PROPOSALS, { min: 2, max: 12 })),
    useWebSearch: process.env.AI_DJ_WEB_SEARCH === "true",
    minConfidence: readPositiveNumber(process.env.AI_DJ_MIN_CONFIDENCE, DEFAULT_MIN_CONFIDENCE, { min: 0, max: 1 }),
  };
}

function compactText(value, limit = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function describeTrack(track) {
  const metadata = getTrackMetadata(track);
  return {
    title: compactText(track?.userData?.autoplayReference?.title || track?.info?.title),
    artist: compactText(track?.userData?.autoplayReference?.artist || track?.info?.author),
    album: compactText(metadata.albumTitle),
    genres: metadata.genres.slice(0, 6),
    tempo: Number.isFinite(metadata.features?.tempo) ? Math.round(metadata.features.tempo) : null,
    energy: Number.isFinite(metadata.features?.energy) ? Number(metadata.features.energy.toFixed(2)) : null,
    valence: Number.isFinite(metadata.features?.valence) ? Number(metadata.features.valence.toFixed(2)) : null,
  };
}

function describeRecentTrack(track) {
  return {
    ...describeTrack(track),
    autoplay: Boolean(track?.userData?.autoplay || track?.info?.autoplayed),
  };
}

function describeVerifiedCandidate(candidate) {
  return {
    title: compactText(candidate?.title || candidate?.track?.info?.title),
    artist: compactText(candidate?.artist || candidate?.track?.info?.author),
    album: compactText(candidate?.albumTitle || candidate?.track?.userData?.albumTitle),
    source: compactText(candidate?.source || candidate?.track?.info?.sourceName, 40),
    genres: Array.isArray(candidate?.genres) ? candidate.genres.slice(0, 5) : [],
  };
}

function buildDirectorInput({ anchorTrack, referenceTrack, profile, context, maxProposals }) {
  return {
    task: "Program the next track in this shared listening session.",
    manualAnchor: describeTrack(anchorTrack),
    currentTrack: describeTrack(referenceTrack),
    manualTaste: {
      genres: (profile.manualTasteGenres || []).slice(0, 8),
      genreFamilies: (profile.manualTasteGenreFamilies || []).slice(0, 8),
      features: profile.manualTasteFeatures || null,
    },
    manualHistory: (profile.manualHistory || []).slice(-8).map(describeRecentTrack),
    manualMemory: {
      tracks: (profile.manualMemoryTracks || []).slice(-24).map(describeTrack),
      artists: (profile.manualArtistMemory || []).slice(0, 12),
      albums: (profile.manualAlbumMemory || []).slice(0, 12),
    },
    recentSession: (profile.recentTracks || []).slice(-8).map(describeRecentTrack),
    upcomingManualTracks: (profile.pendingManualTracks || []).slice(0, 4).map(describeTrack),
    verifiedCatalog: (profile.verifiedCatalogCandidates || []).slice(0, 20).map(describeVerifiedCandidate),
    constraints: {
      anchorGenreFamilies: context.anchorFamilies || [],
      currentGenreFamilies: context.referenceFamilies || [],
      blockedArtists: [...(context.skippedArtists || [])].slice(0, 12),
      sameArtistStreak: context.artistStreak || 0,
      sameAlbumStreak: context.albumStreak || 0,
      softArtistExitAfter: context.softArtistExitStreak || 0,
      softAlbumExitAfter: context.softAlbumExitStreak || 0,
      repeatCooldownMinutes: Math.round((Number(context.repeatCooldownMs) || 0) / 60_000),
      maximumProposals: maxProposals,
      forbidden: "recent repeats, provider mirrors, unrequested alternate versions, generic algorithmic or playlist suggestions",
    },
  };
}

function getCacheKey(model, prompt) {
  return crypto.createHash("sha256").update(`${model}:${JSON.stringify(prompt)}`).digest("hex");
}

function getCachedDecision(key, now = Date.now()) {
  const cached = decisionCache.get(key);
  if (!cached || cached.expiresAt <= now) {
    decisionCache.delete(key);
    return null;
  }
  return cached.decision;
}

function cacheDecision(key, decision, ttlMs) {
  if (ttlMs <= 0) return;
  decisionCache.set(key, { decision, expiresAt: Date.now() + ttlMs });
  if (decisionCache.size > CACHE_LIMIT) decisionCache.delete(decisionCache.keys().next().value);
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function validateDirectorPlan(value, maxProposals) {
  if (!value || typeof value !== "object") return null;
  const decision = value.decision;
  const confidence = Number(value.confidence);
  const direction = value.direction && typeof value.direction === "object" ? {
    summary: compactText(value.direction.summary, 180),
    energy: compactText(value.direction.energy, 80),
    mood: compactText(value.direction.mood, 100),
  } : null;
  const reasons = Array.isArray(value.reasons)
    ? value.reasons.map((reason) => compactText(reason, 180)).filter(Boolean).slice(0, 3)
    : [];
  const seen = new Set();
  const candidates = Array.isArray(value.candidates) ? value.candidates.flatMap((candidate) => {
    const artist = compactText(candidate?.artist, 120);
    const title = compactText(candidate?.title, 160);
    const album = compactText(candidate?.album, 160);
    const reason = compactText(candidate?.reason, 180);
    const key = `${artist.toLowerCase()}|${title.toLowerCase()}`;
    if (!artist || !title || !reason || seen.has(key)) return [];
    seen.add(key);
    return [{ artist, title, album, reason }];
  }).slice(0, maxProposals) : [];

  if (!['propose', 'no_match'].includes(decision) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (!direction?.summary || !direction.energy || !direction.mood || !reasons.length) return null;
  if (decision === "propose" && !candidates.length) return null;
  if (decision === "no_match" && candidates.length) return null;
  return { decision, confidence, direction, candidates, reasons };
}

function isSameRecording(proposal, track) {
  const proposalKeys = new Set(getTrackIdentityKeys(proposal, { includeIdentifier: false }));
  if (!proposalKeys.size) return false;
  return getTrackIdentityKeys(track, { includeIdentifier: false }).some((key) => proposalKeys.has(key));
}

function filterPlanRepeats(plan, { referenceTrack, profile, context }, now = Date.now()) {
  if (!plan?.candidates?.length) return plan;
  const repeatCooldownMs = Math.max(Number(context?.repeatCooldownMs) || 0, 0);
  const rememberedTracks = [
    ...(profile?.cooldownTracks || []),
    ...(profile?.recentTracks || []),
    ...(profile?.manualHistory || []),
  ].filter(Boolean);
  const candidates = plan.candidates.filter((proposal) => {
    if (isSameRecording(proposal, referenceTrack)) return false;
    if (repeatCooldownMs <= 0) return true;
    return !rememberedTracks.some((track) => {
      if (!isSameRecording(proposal, track)) return false;
      const playedAt = Number(track?.userData?.autoplayPlayedAt);
      return !Number.isFinite(playedAt) || now - playedAt < repeatCooldownMs;
    });
  });
  return { ...plan, candidates };
}

async function requestDirectorPlan(config, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  timeout.unref?.();

  try {
    const response = await (fetchForTests || globalThis.fetch)(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        store: false,
        max_output_tokens: 1100,
        reasoning: { effort: config.reasoningEffort },
        tools: config.useWebSearch ? [{ type: "web_search", search_context_size: "low" }] : undefined,
        tool_choice: config.useWebSearch ? "required" : undefined,
        input: [
          { role: "system", content: [{ type: "input_text", text: AI_DJ_DIRECTOR_SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(prompt) }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "mewbit_ai_dj_plan",
            strict: true,
            schema: AI_DJ_DIRECTOR_RESPONSE_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`OpenAI Responses API ${response.status}: ${compactText(payload?.error?.message, 180) || "request failed"}`);
    const outputText = extractOutputText(payload);
    if (!outputText) {
      const incompleteReason = compactText(payload?.incomplete_details?.reason, 80);
      throw new Error(`OpenAI returned no structured director plan${incompleteReason ? ` (${incompleteReason})` : ""}`);
    }
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
}

async function planNextTrackWithAIDJ(input) {
  const config = getConfig();
  if (!config.enabled) return { status: "disabled", plan: null };
  if (!config.apiKey) return { status: "missing-api-key", plan: null };
  if (typeof (fetchForTests || globalThis.fetch) !== "function") return { status: "fetch-unavailable", plan: null };

  const prompt = buildDirectorInput({ ...input, maxProposals: config.maxProposals });
  const cacheKey = getCacheKey(`${config.model}:director:${config.useWebSearch}`, prompt);
  let plan = getCachedDecision(cacheKey);
  const cached = Boolean(plan);

  try {
    if (!plan) {
      plan = validateDirectorPlan(await requestDirectorPlan(config, prompt), config.maxProposals);
      if (!plan) throw new Error("OpenAI returned an invalid AI DJ director plan");
      plan = filterPlanRepeats(plan, input);
      cacheDecision(cacheKey, plan, config.cacheTtlMs);
    }
  } catch (error) {
    Log.warning("AI DJ director unavailable; using deterministic V3 fallback", "", `error=${compactText(error.message, 180)}`);
    return { status: "fallback-error", plan: null };
  }

  if (plan.decision !== "propose" || !plan.candidates.length) return { status: "no-match", plan, cached, model: config.model };
  if (plan.confidence < config.minConfidence) return { status: "low-confidence", plan, cached, model: config.model };
  return { status: "planned", plan, cached, model: config.model };
}

function clearAIDJCacheForTests() {
  decisionCache.clear();
}

function setAIDJFetchForTests(value) {
  fetchForTests = value;
}

module.exports = {
  AI_DJ_DIRECTOR_RESPONSE_SCHEMA,
  AI_DJ_DIRECTOR_SYSTEM_PROMPT,
  buildDirectorInput,
  clearAIDJCacheForTests,
  filterPlanRepeats,
  planNextTrackWithAIDJ,
  setAIDJFetchForTests,
};
