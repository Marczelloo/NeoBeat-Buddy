const { normalizeArtist, scoreCandidates } = require("./candidateScoring");
const { areGenreFamiliesCompatible, getGenreFamilies } = require("./genreUtils");
const { buildSessionProfile } = require("./sessionProfile");
const {
  applyTransitionQualityGuard,
  getDiversifiedResolutionOrder,
  getTransitionQuality,
  partitionRankedCandidates,
} = require("./smartAutoplay");
const { cloneTrack, playbackState, pushTrackHistory, rememberAutoplayTrack } = require("./state");
const { hasTrackIdentity } = require("./trackIdentity");

const DEFAULT_LIMITS = {
  maxDuplicateSelections: 0,
  maxGenreFamilyJumps: 0,
  maxConsecutiveArtist: 2,
  artistWindowSize: 5,
  maxArtistAppearancesInWindow: 2,
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

function choosePlayableCandidate(rankedCandidates, profile, random, { allowDeferredEmergency = false } = {}) {
  const { safe, fallback, deferred } = partitionRankedCandidates(rankedCandidates);
  const order = getDiversifiedResolutionOrder(rankedCandidates, random);
  const safeSet = new Set(safe);
  const fallbackSet = new Set(fallback);
  const deferredSet = new Set(deferred);

  const selected = order.find((candidate) => safeSet.has(candidate) && candidate.playable !== false);
  if (selected) return { candidate: selected, mode: "safe" };

  const fallbackCandidate = order.find(
    (candidate) => fallbackSet.has(candidate) && candidate.playable !== false
  );
  if (fallbackCandidate) return { candidate: fallbackCandidate, mode: "metadata-free-fallback" };

  if (allowDeferredEmergency) {
    const emergency = order.find(
      (candidate) =>
        deferredSet.has(candidate) &&
        candidate.playable !== false &&
        candidate.emergencyEligible !== false &&
        candidate.manualAnchorEvidence
    );
    if (emergency) return { candidate: emergency, mode: "deferred-emergency" };
  }

  return { candidate: null, mode: "unresolved" };
}

function getStepCandidates({ replaySteps, candidateProvider, reference, profile, step, history }) {
  if (typeof candidateProvider === "function") {
    return candidateProvider({ reference, profile, step, history: [...history] }) || [];
  }

  const replayStep = replaySteps?.[step - 1] || replaySteps?.[step];
  return replayStep?.candidates || [];
}

function updateArtistMetrics(metrics, selectedTrack, limits) {
  const artist = normalizeArtist(selectedTrack.info?.author);
  const previousArtist = metrics.artists.at(-1);
  if (artist && artist === previousArtist) {
    metrics.currentArtistStreak += 1;
  } else {
    metrics.currentArtistStreak = 1;
  }
  metrics.artists.push(artist);
  metrics.maxConsecutiveArtist = Math.max(metrics.maxConsecutiveArtist, metrics.currentArtistStreak);

  const window = metrics.artists.slice(-limits.artistWindowSize);
  const appearances = window.filter((entry) => entry === artist).length;
  if (appearances > limits.maxArtistAppearancesInWindow) metrics.artistWindowViolations += 1;
}

function evaluateAutoplaySimulation(result, limits = {}) {
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const violations = [];
  if (result.metrics.duplicateSelections > resolvedLimits.maxDuplicateSelections) {
    violations.push(`duplicate selections=${result.metrics.duplicateSelections}`);
  }
  if (result.metrics.genreFamilyJumps > resolvedLimits.maxGenreFamilyJumps) {
    violations.push(`genre-family jumps=${result.metrics.genreFamilyJumps}`);
  }
  if (result.metrics.maxConsecutiveArtist > resolvedLimits.maxConsecutiveArtist) {
    violations.push(`max consecutive artist=${result.metrics.maxConsecutiveArtist}`);
  }
  if (result.metrics.artistWindowViolations > 0) {
    violations.push(`artist rolling-window violations=${result.metrics.artistWindowViolations}`);
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

function assertAutoplaySimulation(result, limits = {}) {
  const evaluated = evaluateAutoplaySimulation(result, limits);
  if (!evaluated.passed) {
    const details = evaluated.steps
      .filter((step) => step.selected?.mode !== "safe")
      .slice(-5)
      .map((step) => `step ${step.step}: ${step.selected?.mode || "unresolved"}`)
      .join("; ");
    throw new Error(`Autoplay simulation failed: ${evaluated.violations.join(", ")}${details ? ` (${details})` : ""}`);
  }
  return evaluated;
}

function runAutoplaySimulation({
  seedTrack,
  manualTracks = [],
  manualSchedule = [],
  candidateProvider,
  replaySteps,
  steps = 30,
  guildId = `autoplay-simulation-${Date.now()}`,
  seed = 1,
  allowDeferredEmergency = false,
  limits,
} = {}) {
  if (!seedTrack?.info?.identifier) throw new Error("Autoplay simulation requires a seedTrack with info.identifier");
  if (!candidateProvider && !Array.isArray(replaySteps)) {
    throw new Error("Autoplay simulation requires candidateProvider or replaySteps");
  }

  const previousState = playbackState.get(guildId);
  const random = createSeededRandom(seed);
  const history = [];
  const metrics = {
    requestedSteps: steps,
    completedSteps: 0,
    unresolvedSteps: 0,
    duplicateSelections: 0,
    genreFamilyJumps: 0,
    artistWindowViolations: 0,
    maxConsecutiveArtist: 0,
    currentArtistStreak: 0,
    resolutionFailures: 0,
    fallbackSelections: 0,
    deferredSelections: 0,
    longTermRepeats: 0,
    sources: {},
    artists: [],
  };
  const trace = [];
  const noSkips = { skippedArtists: {}, skippedGenres: {} };
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
      const candidates = getStepCandidates({
        replaySteps,
        candidateProvider,
        reference,
        profile,
        step,
        history,
      }).map(cloneCandidate);
      const ranked = scoreCandidates(candidates, profile, noSkips, guildId);
      ranked.forEach((candidate) => {
        candidate.transitionQuality = getTransitionQuality(candidate, profile);
      });
      applyTransitionQualityGuard(ranked, profile);

      const choice = choosePlayableCandidate(ranked, profile, random, { allowDeferredEmergency });
      metrics.resolutionFailures += ranked.filter((candidate) => candidate.playable === false).length;
      const stepTrace = {
        step,
        reference: {
          title: reference.info?.title,
          artist: reference.info?.author,
          identifier: reference.info?.identifier,
        },
        candidateCount: candidates.length,
        rejected: ranked.filter((candidate) => candidate.hardRejected).length,
        deferred: ranked.filter((candidate) => candidate.deferred).length,
        topCandidates: ranked.slice(0, 5).map((candidate) => ({
          title: candidate.title,
          artist: candidate.artist,
          identifier: candidate.identifier,
          score: candidate.score,
          source: candidate.source,
          transitionQuality: candidate.transitionQuality,
          rejectionReason: candidate.rejectionReason,
          deferredReason: candidate.deferredReason,
        })),
        selected: choice.candidate
          ? {
              title: choice.candidate.title,
              artist: choice.candidate.artist,
              identifier: choice.candidate.identifier,
              source: choice.candidate.source,
              score: choice.candidate.score,
              mode: choice.mode,
            }
          : null,
      };

      if (!choice.candidate) {
        metrics.unresolvedSteps += 1;
        trace.push(stepTrace);
        metrics.completedSteps += 1;
        continue;
      }

      const selectedTrack = candidateToTrack(choice.candidate);
      const duplicateInCooldown = hasTrackIdentity(profile.cooldownTracks, selectedTrack, { includeIdentifier: false });
      const duplicateInFullHistory = hasTrackIdentity(history, selectedTrack, { includeIdentifier: false });
      if (duplicateInCooldown) metrics.duplicateSelections += 1;
      else if (duplicateInFullHistory) metrics.longTermRepeats += 1;
      stepTrace.selected.duplicateInCooldown = duplicateInCooldown;
      stepTrace.selected.repeatedAfterCooldown = duplicateInFullHistory && !duplicateInCooldown;

      const previousFamilies = getGenreFamilies(reference.userData?.genres || []);
      const selectedFamilies = getGenreFamilies(selectedTrack.userData?.genres || choice.candidate.genres || []);
      if (areGenreFamiliesCompatible(previousFamilies, selectedFamilies) === false) metrics.genreFamilyJumps += 1;

      updateArtistMetrics(metrics, selectedTrack, { ...DEFAULT_LIMITS, ...limits });
      const source = choice.candidate.source || selectedTrack.info?.sourceName || "unknown";
      metrics.sources[source] = (metrics.sources[source] || 0) + 1;
      if (choice.mode === "metadata-free-fallback") metrics.fallbackSelections += 1;
      if (choice.mode === "deferred-emergency") metrics.deferredSelections += 1;

      pushTrackHistory(guildId, selectedTrack);
      rememberAutoplayTrack(guildId, selectedTrack);
      history.push(selectedTrack);
      reference = selectedTrack;
      trace.push(stepTrace);
      metrics.completedSteps += 1;
    }

    const result = evaluateAutoplaySimulation({ guildId, metrics, steps: trace }, limits);
    return result;
  } finally {
    if (previousState) playbackState.set(guildId, previousState);
    else playbackState.delete(guildId);
  }
}

module.exports = {
  DEFAULT_LIMITS,
  assertAutoplaySimulation,
  createSeededRandom,
  evaluateAutoplaySimulation,
  makeSimulationTrack,
  runAutoplaySimulation,
};
