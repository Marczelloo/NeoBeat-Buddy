const {
  buildAIDJCandidates,
  buildSelectionContext,
  fetchAutoplayV3Track,
  filterAICandidates,
  getRecentTracks,
  orderAIDirectorCandidates,
  selectFallbackCandidates,
} = require("./autoplayV3");
const { getGenreFamilies } = require("./genreUtils");
const { buildSessionProfile } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const { cloneTrack, playbackState, pushTrackHistory, rememberAutoplayTrack } = require("./state");
const { normalizeArtist } = require("./trackIdentity");
const { hasTrackIdentity } = require("./trackIdentity");

const DEFAULT_LIMITS = {
  maxDuplicateSelections: 0,
  maxUnresolvedSteps: 0,
};

function createSeededRandom(seed = 1) {
  let value = Number(seed) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function makeSimulationTrack({ title, artist, identifier, duration = 180000, genres = [], features = null, source = "simulation" }, autoplay = false) {
  return {
    track: `simulation-${identifier}`,
    info: {
      title,
      author: artist,
      identifier,
      length: duration,
      sourceName: source,
      autoplayed: autoplay,
    },
    userData: {
      autoplay,
      genres: [...genres],
      features: features ? { ...features } : null,
      autoplayReference: { title, artist },
    },
  };
}

function cloneCandidate(candidate) {
  return {
    ...candidate,
    genres: [...(candidate.genres || [])],
    features: candidate.features ? { ...candidate.features } : candidate.features,
    derivedFeatures: candidate.derivedFeatures ? { ...candidate.derivedFeatures } : candidate.derivedFeatures,
    track: candidate.track ? cloneTrack(candidate.track) : candidate.track,
    aiDJ: candidate.aiDJ ? { ...candidate.aiDJ } : candidate.aiDJ,
  };
}

function candidateToTrack(candidate) {
  if (candidate.track) return cloneTrack(candidate.track);

  return makeSimulationTrack(
    {
      title: candidate.title,
      artist: candidate.artist,
      identifier: candidate.identifier,
      duration: candidate.duration,
      genres: candidate.genres,
      features: candidate.features,
      source: candidate.source,
    },
    true
  );
}

/**
 * Runs the real V3 selection helpers (AI path + fallback ladder) against
 * injected candidates, without touching Lavalink or OpenAI. `aiPlanner` is a
 * synchronous stand-in for planNextTrackWithAIDJ returning a director-plan
 * shaped result (or null to force the deterministic ladder).
 */
function runAutoplaySimulation({
  seedTrack,
  manualTracks = [],
  manualSchedule = [],
  candidateProvider,
  aiPlanner = null,
  steps = 30,
  guildId = `autoplay-simulation-${Date.now()}`,
  seed = 1,
  minFit = undefined,
  limits,
} = {}) {
  if (!seedTrack?.info?.identifier) throw new Error("Autoplay simulation requires a seedTrack with info.identifier");
  if (!candidateProvider) throw new Error("Autoplay simulation requires candidateProvider");

  const previousState = playbackState.get(guildId);
  const random = createSeededRandom(seed);
  const history = [];
  const metrics = {
    requestedSteps: steps,
    completedSteps: 0,
    unresolvedSteps: 0,
    duplicateSelections: 0,
    genreFamilyJumps: 0,
    aiDirectedSelections: 0,
    fallbackLadderSelections: 0,
    lowFitDrops: 0,
    repeatCooldownRejections: 0,
    maxConsecutiveArtist: 0,
    currentArtistStreak: 0,
    resolutionFailures: 0,
    longTermRepeats: 0,
    sources: {},
    artists: [],
    laneCounts: {},
  };
  const trace = [];
  const sortedManualSchedule = [...manualSchedule].sort((left, right) => Number(left.step) - Number(right.step));

  try {
    playbackState.delete(guildId);
    for (const track of [...manualTracks, seedTrack]) {
      const manual = cloneTrack(track);
      manual.info = { ...(manual.info || {}), autoplayed: false };
      manual.userData = { ...(manual.userData || {}), autoplay: false };
      pushTrackHistory(guildId, manual);
      history.push(manual);
    }

    let reference = cloneTrack(seedTrack);
    for (let step = 1; step <= steps; step += 1) {
      const scheduled = sortedManualSchedule.find((entry) => Number(entry.step) === step);
      if (scheduled?.track) {
        reference = cloneTrack(scheduled.track);
        reference.info = { ...(reference.info || {}), autoplayed: false };
        reference.userData = { ...(reference.userData || {}), autoplay: false };
        pushTrackHistory(guildId, reference);
        history.push(reference);
      }

      const profile = buildSessionProfile(guildId, reference);
      const recentTracks = getRecentTracks(profile, reference);
      const context = buildSelectionContext({
        profile,
        exposure: null,
        referenceTrack: reference,
        recentTracks,
        skipPatterns: getSkipPatterns(guildId),
        anchorTrack: reference,
      });
      const candidates = candidateProvider({ reference, profile, step, history: [...history], context }).map(cloneCandidate);
      profile.verifiedCatalogCandidates = candidates;

      const stepTrace = {
        step,
        reference: {
          title: reference.info?.title,
          artist: reference.info?.author,
          identifier: reference.info?.identifier,
        },
        candidateCount: candidates.length,
        aiCandidates: [],
        rejectedAi: {},
        deferred: null,
        selected: null,
      };

      let chosen = null;
      let mode = "unresolved";
      if (typeof aiPlanner === "function") {
        const aiResult = aiPlanner({ reference, profile, context, step, candidates });
        const aiCandidates = buildAIDJCandidates(aiResult, candidates);
        stepTrace.aiCandidates = aiCandidates.map((candidate) => ({
          title: candidate.title,
          artist: candidate.artist,
          lane: candidate.aiDjLane,
          fit: candidate.aiDjFit,
          energy: candidate.aiDjEnergy,
        }));
        if (aiCandidates.length) {
          const filtered = filterAICandidates(aiCandidates, context, minFit === undefined ? {} : { minFit });
          stepTrace.rejectedAi = filtered.rejected;
          metrics.lowFitDrops += filtered.rejected["low-fit"] || 0;
          metrics.repeatCooldownRejections += filtered.rejected["recent-duplicate"] || 0;
          const ordered = orderAIDirectorCandidates(filtered.ranked, context, random);
          stepTrace.deferred = ordered.deferred;
          const winner = ordered.ranked.find((entry) => entry.candidate.playable !== false);
          if (winner) {
            chosen = { candidate: winner.candidate, details: winner.details };
            mode = "ai-director";
            const lane = String(winner.candidate.aiDjLane || "unknown");
            metrics.laneCounts[lane] = (metrics.laneCounts[lane] || 0) + 1;
          }
        }
      }

      if (!chosen) {
        const { ranked } = selectFallbackCandidates(candidates, context);
        const winner = ranked.find((entry) => entry.candidate.playable !== false);
        if (winner) {
          chosen = winner;
          mode = "fallback-ladder";
        }
      }

      stepTrace.selected = chosen
        ? {
            title: chosen.candidate.title,
            artist: chosen.candidate.artist,
            identifier: chosen.candidate.identifier,
            source: chosen.candidate.source,
            score: chosen.score ?? chosen.candidate.aiDjFit ?? null,
            mode,
          }
        : null;

      if (!chosen) {
        metrics.unresolvedSteps += 1;
        trace.push(stepTrace);
        metrics.completedSteps += 1;
        continue;
      }

      if (mode === "ai-director") metrics.aiDirectedSelections += 1;
      else metrics.fallbackLadderSelections += 1;

      const selectedTrack = candidateToTrack(chosen.candidate);
      selectedTrack.userData = {
        ...(selectedTrack.userData || {}),
        autoplay: true,
      };
      selectedTrack.info = { ...(selectedTrack.info || {}), autoplayed: true };

      const duplicateInCooldown = hasTrackIdentity(profile.cooldownTracks, selectedTrack, { includeIdentifier: false });
      const duplicateInFullHistory = hasTrackIdentity(history, selectedTrack, { includeIdentifier: false });
      if (duplicateInCooldown) metrics.duplicateSelections += 1;
      else if (duplicateInFullHistory) metrics.longTermRepeats += 1;
      stepTrace.selected.duplicateInCooldown = duplicateInCooldown;
      stepTrace.selected.repeatedAfterCooldown = duplicateInFullHistory && !duplicateInCooldown;

      const previousFamilies = getGenreFamilies(reference.userData?.genres || []);
      const selectedFamilies = getGenreFamilies(selectedTrack.userData?.genres || chosen.candidate.genres || []);
      if (areFamiliesJump(previousFamilies, selectedFamilies)) metrics.genreFamilyJumps += 1;

      updateArtistMetrics(metrics, selectedTrack);
      const source = chosen.candidate.source || selectedTrack.info?.sourceName || "unknown";
      metrics.sources[source] = (metrics.sources[source] || 0) + 1;

      pushTrackHistory(guildId, selectedTrack);
      rememberAutoplayTrack(guildId, selectedTrack);
      history.push(selectedTrack);
      reference = selectedTrack;
      trace.push(stepTrace);
      metrics.completedSteps += 1;
    }

    return evaluateAutoplaySimulation({ guildId, metrics, steps: trace }, limits);
  } finally {
    if (previousState) playbackState.set(guildId, previousState);
    else playbackState.delete(guildId);
  }
}

function areFamiliesJump(left, right) {
  if (!left.length && !right.length) return false;
  return left.some((family) => right.includes(family)) === false
    && left.length > 0 && right.length > 0;
}

function updateArtistMetrics(metrics, selectedTrack) {
  const artist = normalizeArtist(selectedTrack.info?.author);
  const previousArtist = metrics.artists.at(-1);
  if (artist && artist === previousArtist) {
    metrics.currentArtistStreak += 1;
  } else {
    metrics.currentArtistStreak = 1;
  }
  metrics.artists.push(artist);
  metrics.maxConsecutiveArtist = Math.max(metrics.maxConsecutiveArtist, metrics.currentArtistStreak);
}

function evaluateAutoplaySimulation(result, limits = {}) {
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const violations = [];
  if (result.metrics.duplicateSelections > resolvedLimits.maxDuplicateSelections) {
    violations.push(`duplicate selections=${result.metrics.duplicateSelections}`);
  }
  if (Number.isFinite(resolvedLimits.maxGenreFamilyJumps) && result.metrics.genreFamilyJumps > resolvedLimits.maxGenreFamilyJumps) {
    violations.push(`genre-family jumps=${result.metrics.genreFamilyJumps}`);
  }
  if (Number.isFinite(resolvedLimits.maxConsecutiveArtist) && result.metrics.maxConsecutiveArtist > resolvedLimits.maxConsecutiveArtist) {
    violations.push(`max consecutive artist=${result.metrics.maxConsecutiveArtist}`);
  }
  if (
    Number.isFinite(resolvedLimits.artistWindowSize) &&
    Number.isFinite(resolvedLimits.maxArtistAppearancesInWindow)
  ) {
    const window = result.metrics.artists.slice(-resolvedLimits.artistWindowSize);
    const offenders = [...new Set(window)].filter((artist) =>
      window.filter((entry) => entry === artist).length > resolvedLimits.maxArtistAppearancesInWindow
    );
    if (offenders.length) violations.push(`artist window over-represented=${offenders.join(",")}`);
  }
  if (result.metrics.unresolvedSteps > resolvedLimits.maxUnresolvedSteps) {
    violations.push(`unresolved steps=${result.metrics.unresolvedSteps}`);
  }

  return {
    ...result,
    limits: resolvedLimits,
    passed: violations.length === 0,
    violations,
  };
}

module.exports = {
  DEFAULT_LIMITS,
  createSeededRandom,
  evaluateAutoplaySimulation,
  fetchAutoplayV3Track,
  makeSimulationTrack,
  runAutoplaySimulation,
};
