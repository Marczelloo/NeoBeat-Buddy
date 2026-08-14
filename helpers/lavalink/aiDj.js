const crypto = require("node:crypto");
const Log = require("../logs/log");
const { getTrackMetadata } = require("./sessionProfile");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-terra";
const DEFAULT_REASONING_EFFORT = "low";
const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_CANDIDATES = 12;
const DEFAULT_MIN_CONFIDENCE = 0.55;
const DEFAULT_MIN_BASELINE_DELTA = 8;
const CACHE_LIMIT = 300;
const REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);

const AI_DJ_SYSTEM_PROMPT = `You are MewBit AI DJ, a conservative music-programming judge for a shared Discord listening room.

The deterministic baseline is candidate c1. Your job is not to rubber-stamp it: only promote c2 or later when its supplied evidence gives it a clearly, materially better transition than c1. If no candidate clearly beats c1, select c1 with baselineDelta 0. You are not a search engine and must never invent, rename, or request music outside the candidate IDs.

The manual anchor is the room's strongest taste signal. Preserve its genre, emotional tone, energy, and cultural lane while making the transition from the current song feel intentional. Prefer explicit relationship evidence (Last.fm similarity, album neighbours, trusted YouTube Mix) over title similarity or popularity.

Hard constraints have already been enforced before you see the shortlist: no provider mirrors/duplicates, forbidden alternate versions, incompatible genre jumps, skipped artists, and continuity safety limits. Do not try to override them. A same-artist or same-album continuation is desirable when it has a direct relationship and stays genre-compatible; do not force variety for its own sake.

Use only the supplied metadata. Do not claim knowledge of audio, lyrics, chart success, artists, or albums that is absent from the input. If none of the candidates forms a convincing transition, return decision "no_match" with candidateId "none". Keep reasons short and evidence-based.`;

const AI_DJ_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "candidateId", "confidence", "transitionScore", "baselineDelta", "reasons"],
  properties: {
    decision: { type: "string", enum: ["select", "no_match"] },
    candidateId: { type: "string" },
    confidence: { type: "number" },
    transitionScore: { type: "integer" },
    baselineDelta: { type: "integer", minimum: -100, maximum: 100 },
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
    maxCandidates: Math.floor(readPositiveNumber(process.env.AI_DJ_MAX_CANDIDATES, DEFAULT_MAX_CANDIDATES, { min: 2, max: 20 })),
    minConfidence: readPositiveNumber(process.env.AI_DJ_MIN_CONFIDENCE, DEFAULT_MIN_CONFIDENCE, { min: 0, max: 1 }),
    minBaselineDelta: readPositiveNumber(process.env.AI_DJ_MIN_BASELINE_DELTA, DEFAULT_MIN_BASELINE_DELTA, { min: 0, max: 50 }),
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

function describeCandidate(entry, candidateId) {
  const candidate = entry.candidate || {};
  return {
    id: candidateId,
    title: compactText(candidate.title),
    artist: compactText(candidate.artist),
    album: compactText(candidate.albumTitle),
    genres: Array.isArray(candidate.genres) ? candidate.genres.slice(0, 6) : [],
    source: compactText(candidate.source, 32),
    relation: Number.isFinite(entry.details?.relation) ? entry.details.relation : 0,
    genreFit: Number.isFinite(entry.details?.genreScore) ? entry.details.genreScore : 0,
    sameArtist: Boolean(entry.details?.sameArtist),
    sameAlbum: Boolean(entry.details?.sameAlbum),
    similarity: Number.isFinite(candidate.similarity) ? Number(candidate.similarity.toFixed(3)) : null,
  };
}

function buildDecisionInput({ anchorTrack, referenceTrack, profile, context, ranked, maxCandidates }) {
  const annotatedRanked = ranked.map((entry, index) => (
    index < maxCandidates ? { ...entry, aiDjCandidateId: `c${index + 1}` } : entry
  ));
  const shortlist = annotatedRanked.slice(0, maxCandidates).map((entry) => ({
    entry,
    data: describeCandidate(entry, entry.aiDjCandidateId),
  }));

  return {
    ranked: annotatedRanked,
    shortlist,
    prompt: {
      task: "Select the next track for the shared room.",
      manualAnchor: describeTrack(anchorTrack),
      currentTrack: describeTrack(referenceTrack),
      recentTransitions: (profile.recentTracks || []).slice(-6).map(describeTrack),
      upcomingManualTracks: (profile.pendingManualTracks || []).slice(0, 4).map(describeTrack),
      constraints: {
        anchorGenreFamilies: context.anchorFamilies || [],
        currentGenreFamilies: context.referenceFamilies || [],
        sameArtistStreak: context.artistStreak || 0,
        sameAlbumStreak: context.albumStreak || 0,
      },
      baselineCandidateId: shortlist[0]?.entry.aiDjCandidateId || null,
      promotionRule: "Select c2 or later only when it has a material evidence-based advantage over c1. Report that advantage in baselineDelta; use 0 when selecting c1.",
      candidates: shortlist.map(({ data }) => data),
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
  if (decisionCache.size > CACHE_LIMIT) {
    const oldest = decisionCache.keys().next().value;
    decisionCache.delete(oldest);
  }
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

function validateDecision(value, allowedCandidateIds) {
  if (!value || typeof value !== "object") return null;
  const decision = value.decision;
  const candidateId = String(value.candidateId || "");
  const confidence = Number(value.confidence);
  const transitionScore = Number(value.transitionScore);
  const baselineDelta = Number(value.baselineDelta);
  const reasons = Array.isArray(value.reasons) ? value.reasons.map((reason) => compactText(reason, 160)).filter(Boolean).slice(0, 3) : [];

  if (!['select', 'no_match'].includes(decision) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (!Number.isInteger(transitionScore) || transitionScore < 0 || transitionScore > 100 || !Number.isInteger(baselineDelta) || baselineDelta < -100 || baselineDelta > 100 || !reasons.length) return null;
  if (decision === "select" && !allowedCandidateIds.has(candidateId)) return null;
  if (decision === "no_match" && candidateId !== "none") return null;

  return { decision, candidateId, confidence, transitionScore, baselineDelta, reasons };
}

async function requestDecision(config, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  timeout.unref?.();

  try {
    const response = await (fetchForTests || globalThis.fetch)(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        store: false,
        max_output_tokens: 600,
        reasoning: { effort: config.reasoningEffort },
        input: [
          { role: "system", content: [{ type: "input_text", text: AI_DJ_SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(prompt) }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "mewbit_ai_dj_decision",
            strict: true,
            schema: AI_DJ_RESPONSE_SCHEMA,
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
      throw new Error(`OpenAI returned no structured decision${incompleteReason ? ` (${incompleteReason})` : ""}`);
    }
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
}

async function rerankCandidatesWithAIDJ(input) {
  const config = getConfig();
  const original = input.ranked || [];
  if (!original.length) return { ranked: original, status: "empty" };
  if (!config.enabled) return { ranked: original, status: "disabled" };
  if (!config.apiKey) return { ranked: original, status: "missing-api-key" };
  if (typeof (fetchForTests || globalThis.fetch) !== "function") return { ranked: original, status: "fetch-unavailable" };

  const { ranked, shortlist, prompt } = buildDecisionInput({ ...input, maxCandidates: config.maxCandidates });
  const entriesById = new Map(shortlist.map(({ entry }) => [entry.aiDjCandidateId, entry]));
  const cacheKey = getCacheKey(config.model, prompt);
  let decision = getCachedDecision(cacheKey);
  let cached = Boolean(decision);

  try {
    if (!decision) {
      decision = await requestDecision(config, prompt);
      decision = validateDecision(decision, new Set(entriesById.keys()));
      if (!decision) throw new Error("OpenAI returned an invalid AI DJ decision");
      cacheDecision(cacheKey, decision, config.cacheTtlMs);
    }
  } catch (error) {
    Log.warning("AI DJ unavailable; using deterministic V3 selection", "", `error=${compactText(error.message, 180)}`);
    return { ranked: original, status: "fallback-error" };
  }

  if (decision.decision !== "select") return { ranked: original, status: "no-match", decision, cached };
  if (decision.confidence < config.minConfidence) return { ranked: original, status: "low-confidence", decision, cached };

  const baselineCandidateId = shortlist[0]?.entry.aiDjCandidateId;
  if (decision.candidateId === baselineCandidateId) {
    return { ranked: original, status: "baseline-confirmed", decision, cached, model: config.model };
  }
  if (decision.baselineDelta < config.minBaselineDelta) {
    return { ranked: original, status: "baseline-not-beaten", decision, cached, model: config.model };
  }

  const selected = entriesById.get(decision.candidateId);
  const remaining = ranked.filter((entry) => entry.aiDjCandidateId !== decision.candidateId);
  return {
    ranked: [selected, ...remaining],
    status: "selected",
    decision,
    cached,
    model: config.model,
  };
}

function clearAIDJCacheForTests() {
  decisionCache.clear();
}

function setAIDJFetchForTests(value) {
  fetchForTests = value;
}

module.exports = {
  AI_DJ_RESPONSE_SCHEMA,
  AI_DJ_SYSTEM_PROMPT,
  buildDecisionInput,
  clearAIDJCacheForTests,
  rerankCandidatesWithAIDJ,
  setAIDJFetchForTests,
};
