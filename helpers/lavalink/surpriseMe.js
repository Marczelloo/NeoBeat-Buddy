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

function buildSurpriseSeedPool({ currentTrack, roomHistory = [], userHistory = [], likedTracks = [], topTracks = [] } = {}) {
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

  const topCounts = new Map(topTracks.map((entry) => [normalize(entry.track), Number(entry.count) || 0]));
  for (const seed of pool.values()) {
    const count = topCounts.get(seed.key) || 0;
    if (count > 0) {
      seed.sources.add("top");
      seed.frequency += count;
      seed.score += Math.min(38, 10 + Math.log2(count + 1) * 7);
    }
  }

  return [...pool.values()].map((seed) => ({ ...seed, sources: [...seed.sources] }));
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
  if (intent === "familiar") weight *= sources.has("top") ? 2.1 : sources.has("liked") ? 1.7 : sources.has("history") ? 1.35 : 0.7;
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

function clearSurpriseMemory() {
  listenerMemory.clear();
}

module.exports = {
  INTENTS,
  buildSurpriseSeedPool,
  clearSurpriseMemory,
  getTrackKey,
  selectSurpriseSeed,
  toReferenceTrack,
};
