const INTENTS = Object.freeze({
  flow: {
    weight: 20,
    goal: "Continue the room's current musical flow with a fresh, natural next track.",
    preferredLanes: ["continuation", "bridge"],
  },
  familiar: {
    weight: 16,
    goal: "Use the listener's recurring artists, liked tracks, and recent choices without replaying them directly.",
    preferredLanes: ["continuation", "bridge"],
  },
  popular: {
    weight: 42,
    goal: "Choose a currently popular recording when it clearly fits this listener and the room's active mood.",
    preferredLanes: ["bridge", "continuation"],
  },
  discovery: {
    weight: 22,
    goal: "Find a less obvious hidden gem that clearly belongs beside the listener's taste anchor.",
    preferredLanes: ["explore", "bridge"],
  },
});

const listenerMemory = new Map();
const MAX_LISTENER_MEMORY = 500;
const FREESTYLE_CHART_WINDOW = 12;
const FREESTYLE_SHORTLIST_SIZE = 5;
const FREESTYLE_RESOLVE_DEADLINE_MS = 6_500;

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getTrackParts(track) {
  const source = track?.track && typeof track.track === "object" && !track.info ? track.track : track;
  const info = source?.info || {};
  return {
    source,
    title: String(info.title || source?.title || "").trim(),
    author: String(info.author || source?.author || "").trim(),
  };
}

function getTrackKey(track) {
  const { title, author } = getTrackParts(track);
  return title && author ? `${normalize(author)} - ${normalize(title)}` : "";
}

function toReferenceTrack(track) {
  const { source, title, author } = getTrackParts(track);
  if (!title || !author) return null;
  const info = source?.info || {};
  return {
    ...source,
    info: {
      ...info,
      title,
      author,
      identifier: info.identifier || source?.identifier || null,
      uri: info.uri || source?.uri || null,
      length: info.length ?? source?.length ?? source?.durationMs ?? 0,
      sourceName: info.sourceName || source?.sourceName || source?.source || "unknown",
    },
    userData: { ...(source?.userData || {}) },
  };
}

function addSeed(pool, track, source, score, frequency = 1) {
  const reference = toReferenceTrack(track);
  const key = getTrackKey(reference);
  if (!key) return;
  const existing = pool.get(key) || { key, track: reference, score: 0, frequency: 0, sources: new Set() };
  existing.score += Math.max(0, Number(score) || 0);
  existing.frequency += Math.max(0, Number(frequency) || 0);
  existing.sources.add(source);
  pool.set(key, existing);
}

function buildSurpriseSeedPool({
  currentTrack,
  roomHistory = [],
  userHistory = [],
  likedTracks = [],
  topTracks = [],
  feedbackTracks = [],
  avoidTracks = [],
} = {}) {
  const pool = new Map();
  if (currentTrack) addSeed(pool, currentTrack, "current", 54, 2);

  roomHistory.slice(-30).reverse().forEach((track, index) => {
    addSeed(pool, track, "room", Math.max(8, 30 - index), 1);
  });
  userHistory.slice(0, 50).forEach((entry, index) => {
    addSeed(pool, entry?.track || entry, "history", Math.max(7, 32 - index * 0.55), 1);
  });
  likedTracks.slice(-50).reverse().forEach((track, index) => {
    addSeed(pool, track, "liked", Math.max(10, 26 - index * 0.25), 1);
  });
  // Explicit listener feedback is a stronger intent signal than a passive
  // play. It is deliberately additive: a single thumbs-up should not erase
  // the room's current direction, only make it easier to return to that lane.
  feedbackTracks.slice(-40).reverse().forEach((track, index) => {
    addSeed(pool, track, "feedback", Math.max(18, 42 - index * 0.7), 2);
  });

  const topCounts = new Map(topTracks.map((entry) => [normalize(entry.track), Number(entry.count) || 0]));
  for (const seed of pool.values()) {
    const count = topCounts.get(seed.key) || 0;
    if (count > 0) {
      seed.sources.add("top");
      seed.frequency += count;
      seed.score += Math.min(38, 10 + Math.log2(count + 1) * 7);
    }
  }

  // "Not this direction" is actionable feedback: exclude equivalent copies
  // from every provider while retaining the listener's other taste signals.
  const avoidedKeys = new Set(avoidTracks.map(getTrackKey).filter(Boolean));
  return [...pool.values()]
    .filter((seed) => !avoidedKeys.has(seed.key))
    .map((seed) => ({ ...seed, sources: [...seed.sources] }));
}

function weightedPick(items, getWeight, random = Math.random) {
  if (!items.length) return null;
  const weighted = items.map((item) => ({ item, weight: Math.max(0, Number(getWeight(item)) || 0) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return weighted[0].item;
  let roll = Math.min(Math.max(Number(random()) || 0, 0), 0.999999) * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll < 0) return entry.item;
  }
  return weighted.at(-1).item;
}

function chooseIntent(memory, random) {
  const recent = memory.intents || [];
  const blocked = new Set(recent.slice(-1));
  if (recent.length >= 4) {
    const tail = recent.slice(-4);
    if (tail[0] === tail[2] && tail[1] === tail[3]) {
      blocked.add(tail[0]);
      blocked.add(tail[1]);
    }
  }
  const available = Object.entries(INTENTS).filter(([name]) => !blocked.has(name));
  return weightedPick(available, ([, config]) => config.weight, random)?.[0] || "flow";
}

function seedWeight(seed, intent) {
  let weight = Math.max(seed.score, 1);
  const sources = new Set(seed.sources);
  if (intent === "flow") weight *= sources.has("current") ? 2.4 : sources.has("room") ? 1.55 : 0.75;
  if (intent === "familiar") weight *= sources.has("feedback") ? 2.5 : sources.has("top") ? 2.1 : sources.has("liked") ? 1.7 : sources.has("history") ? 1.35 : 0.7;
  if (intent === "popular") weight *= 1 + Math.min(seed.frequency, 12) * 0.16;
  if (intent === "discovery") weight *= sources.has("liked") || sources.has("history") ? 1.25 : 0.85;
  return weight;
}

function trimMemory() {
  if (listenerMemory.size <= MAX_LISTENER_MEMORY) return;
  listenerMemory.delete(listenerMemory.keys().next().value);
}

function selectSurpriseSeed(input, { random = Math.random, memoryKey = "default" } = {}) {
  const seeds = buildSurpriseSeedPool(input);
  if (!seeds.length) return null;

  const memory = listenerMemory.get(memoryKey) || { intents: [], seeds: [] };
  const intent = chooseIntent(memory, random);
  const recentSeeds = new Set(memory.seeds.slice(-5));
  const freshSeeds = seeds.filter((seed) => !recentSeeds.has(seed.key));
  const candidates = freshSeeds.length ? freshSeeds : seeds.filter((seed) => seed.key !== memory.seeds.at(-1));
  const seed = weightedPick(candidates.length ? candidates : seeds, (entry) => seedWeight(entry, intent), random);
  if (!seed) return null;

  memory.intents = [...memory.intents, intent].slice(-6);
  memory.seeds = [...memory.seeds, seed.key].slice(-8);
  listenerMemory.set(memoryKey, memory);
  trimMemory();

  return {
    seed: seed.track,
    seedKey: seed.key,
    intent: {
      mode: intent,
      goal: INTENTS[intent].goal,
      preferredLanes: INTENTS[intent].preferredLanes,
    },
  };
}

function getFreestyleCandidateKey(candidate) {
  return getTrackKey({ info: { title: candidate?.title, author: candidate?.artist } });
}

function freestyleQuality(candidate) {
  const position = Math.max(1, Number(candidate?.chartPosition) || FREESTYLE_CHART_WINDOW + 1);
  const popularity = Math.max(0, Math.min(100, Number(candidate?.popularity) || 0));
  const catalogRank = Math.max(0, Number(candidate?.catalogRank) || 0);
  // Chart order remains the authority. Catalog rank only separates otherwise
  // close chart positions, so a viral but low-quality mirror cannot leapfrog
  // a verified chart leader.
  return Math.max(0, FREESTYLE_CHART_WINDOW + 1 - position) * 24
    + popularity * 1.35
    + Math.min(18, Math.log10(Math.max(1, catalogRank)) * 2);
}

function selectFreestyleCandidates(candidates, { memoryKey = "default", count = FREESTYLE_SHORTLIST_SIZE, random = Math.random } = {}) {
  const memory = listenerMemory.get(memoryKey) || { intents: [], seeds: [], freestyleTracks: [] };
  const recentlyPlayed = new Set(memory.freestyleTracks || []);
  const valid = (candidates || [])
    .filter((candidate) => candidate?.artist && candidate?.title)
    .filter((candidate) => Number(candidate.duration || 0) >= 100_000)
    .sort((left, right) => freestyleQuality(right) - freestyleQuality(left));
  const fresh = valid.filter((candidate) => !recentlyPlayed.has(getFreestyleCandidateKey(candidate)));
  const sourcePool = fresh.length >= Math.min(3, count) ? fresh : valid;
  const pool = sourcePool.slice(0, Math.max(FREESTYLE_CHART_WINDOW, count));
  const selected = [];
  const usedArtists = new Set();
  let remaining = [...pool];

  while (remaining.length && selected.length < count) {
    const distinctArtists = remaining.filter((entry) => !usedArtists.has(normalize(entry.artist)));
    const candidatesForPick = distinctArtists.length ? distinctArtists : remaining;
    const candidate = weightedPick(candidatesForPick, (entry) => {
      // Keep the opening pick fresh, but confine chance to the proven chart
      // window rather than allowing a low-ranked result to win on speed.
      return Math.max(1, freestyleQuality(entry) ** 1.55);
    }, random);
    if (!candidate) break;
    selected.push(candidate);
    usedArtists.add(normalize(candidate.artist));
    remaining = remaining.filter((entry) => entry !== candidate);
  }

  return selected;
}

function rememberFreestyleCandidate(candidate, memoryKey = "default") {
  const key = getFreestyleCandidateKey(candidate);
  if (!key) return;
  const memory = listenerMemory.get(memoryKey) || { intents: [], seeds: [], freestyleTracks: [] };
  memory.freestyleTracks = [...(memory.freestyleTracks || []).filter((item) => item !== key), key].slice(-16);
  listenerMemory.set(memoryKey, memory);
  trimMemory();
}

/**
 * Cold-start Surprise Me path. It deliberately does not pretend an empty
 * room has a vibe: choose from a narrow, current chart window and resolve a
 * small quality-ranked shortlist in parallel. Resolution speed must never be
 * the reason a lower-ranked song beats the intended opening pick.
 */
async function fetchFreestyleSurpriseTrack(guildId, { memoryKey = "default", random = Math.random } = {}) {
  const { applyCandidateMetadata, fetchDeezerChartCandidates, resolveToPlayable } = require("./autoplayCandidates");
  const { isValidSong } = require("./trackValidation");
  const chartCandidates = await fetchDeezerChartCandidates(guildId, { limit: FREESTYLE_CHART_WINDOW });
  const shortlist = selectFreestyleCandidates(chartCandidates, { memoryKey, count: FREESTYLE_SHORTLIST_SIZE, random });
  if (!shortlist.length) return null;

  const resolved = new Map();
  const attempts = shortlist.map((candidate, index) => (async () => {
    const track = await resolveToPlayable(candidate, guildId, {
      providerSources: ["youtube", "soundcloud"],
      debugLabel: `surprise-freestyle:${candidate.artist} - ${candidate.title}`,
    });
    if (!isValidSong(track?.info, { allowStreams: false, strictDuration: true, excludeInterludes: true })) {
      return null;
    }
    applyCandidateMetadata(track, candidate);
    const outcome = { candidate, track };
    resolved.set(index, outcome);
    return outcome;
  })().catch(() => null));

  try {
    // Wait briefly for the parallel providers, then prefer the highest-ranked
    // candidate that actually resolved. We never let a slow mirror make the
    // opening CTA feel stuck just because a lower-priority request is hung.
    let deadline;
    await Promise.race([
      Promise.all(attempts),
      new Promise((resolve) => { deadline = setTimeout(resolve, FREESTYLE_RESOLVE_DEADLINE_MS); }),
    ]);
    clearTimeout(deadline);
    const winner = shortlist.map((_, index) => resolved.get(index)).find(Boolean);
    if (!winner) return null;
    winner.track.userData = {
      ...(winner.track.userData || {}),
      surpriseMe: "freestyle",
      surpriseSource: "global_chart",
      surpriseChartPosition: Number(winner.candidate.chartPosition) || null,
    };
    rememberFreestyleCandidate(winner.candidate, memoryKey);
    return winner.track;
  } catch {
    return null;
  }
}

function clearSurpriseMemory() {
  listenerMemory.clear();
}

module.exports = {
  INTENTS,
  buildSurpriseSeedPool,
  clearSurpriseMemory,
  fetchFreestyleSurpriseTrack,
  getFreestyleCandidateKey,
  getTrackKey,
  rememberFreestyleCandidate,
  selectFreestyleCandidates,
  selectSurpriseSeed,
  toReferenceTrack,
};
