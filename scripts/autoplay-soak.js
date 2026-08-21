#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const {
  makeSimulationTrack,
  runAutoplaySimulation,
} = require("../helpers/lavalink/autoplaySimulator");

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") args.json = true;
    else if (value === "--fixture") args.fixture = argv[++index];
    else if (value === "--steps") args.steps = Number(argv[++index]);
    else if (value === "--seed") args.seed = Number(argv[++index]);
    else if (value === "--allow-unresolved") args.allowUnresolved = Number(argv[++index]);
    else if (value === "--help" || value === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: pnpm test:autoplay:soak [options]

Offline simulation of the AI-first autoplay selection (no Lavalink/OpenAI).

Options:
  --fixture <path>       Replay a JSON fixture with seedTrack and candidatesByReference
  --steps <number>       Number of automatic cycles (default: 100 for the built-in scenario)
  --seed <number>        Deterministic selection seed (default: 42)
  --allow-unresolved <n> Allow at most n cycles without a playable candidate
  --json                 Print machine-readable JSON instead of the summary
`);
}

function builtInScenario(steps = 100) {
  const artists = ["Neon Echo", "Pixel Bloom", "Chrome Fox", "Lunar Drift", "Signal Bloom"];
  const seedTrack = makeSimulationTrack({
    title: "Neon Seed",
    artist: "Manual Listener",
    identifier: "manual-seed",
    genres: ["synthwave"],
    features: { tempo: 120, energy: 0.58, valence: 0.5, danceability: 0.7 },
  });

  return {
    seedTrack,
    steps,
    // No director in the offline built-in scenario: exercise the emergency
    // ladder exactly like an OpenAI outage would.
    aiPlanner: null,
    candidateProvider: ({ step }) => {
      const artist = artists[(step - 1) % artists.length];
      return [
        {
          title: `Neon Track ${step}`,
          artist,
          identifier: `neon-${step}`,
          source: "lastfm_similar",
          genres: ["synthwave"],
          features: { tempo: 120, energy: 0.58, valence: 0.5, danceability: 0.7 },
          similarity: 0.82,
          duration: 180000,
        },
        {
          title: "Neon Seed",
          artist: "Manual Listener",
          identifier: `mirror-${step}`,
          source: "deezer_recommendations",
          genres: ["synthwave"],
          features: { tempo: 120, energy: 0.58, valence: 0.5, danceability: 0.7 },
          similarity: 0.99,
          duration: 180000,
        },
      ];
    },
  };
}

function loadFixture(fixturePath, overrideSteps) {
  const absolutePath = path.resolve(process.cwd(), fixturePath);
  const fixture = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const candidatesByReference = fixture.candidatesByReference || {};
  const candidateProvider = ({ reference }) =>
    candidatesByReference[reference.info?.identifier] || candidatesByReference["*"] || [];

  return {
    ...fixture,
    steps: overrideSteps || fixture.steps || 30,
    candidateProvider,
  };
}

function summarize(result) {
  return {
    passed: result.passed,
    guildId: result.guildId,
    requestedSteps: result.metrics.requestedSteps,
    completedSteps: result.metrics.completedSteps,
    unresolvedSteps: result.metrics.unresolvedSteps,
    duplicateSelections: result.metrics.duplicateSelections,
    genreFamilyJumps: result.metrics.genreFamilyJumps,
    maxConsecutiveArtist: result.metrics.maxConsecutiveArtist,
    aiDirectedSelections: result.metrics.aiDirectedSelections,
    fallbackLadderSelections: result.metrics.fallbackLadderSelections,
    lowFitDrops: result.metrics.lowFitDrops,
    repeatCooldownRejections: result.metrics.repeatCooldownRejections,
    longTermRepeats: result.metrics.longTermRepeats,
    sources: result.metrics.sources,
    lanes: result.metrics.laneCounts,
    violations: result.violations,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const scenario = args.fixture
    ? loadFixture(args.fixture, args.steps)
    : builtInScenario(args.steps || 100);
  const limits = {
    ...(scenario.limits || {}),
    ...(args.allowUnresolved === undefined ? {} : { maxUnresolvedSteps: args.allowUnresolved }),
  };
  const result = runAutoplaySimulation({
    ...scenario,
    seed: args.seed ?? scenario.seed ?? 42,
    limits,
  });

  if (args.json) console.log(JSON.stringify(summarize(result), null, 2));
  else {
    const summary = summarize(result);
    console.log(`Autoplay soak ${summary.passed ? "PASSED" : "FAILED"}`);
    console.log(`cycles=${summary.completedSteps}/${summary.requestedSteps}`);
    console.log(`unresolved=${summary.unresolvedSteps}`);
    console.log(`duplicates=${summary.duplicateSelections} genreJumps=${summary.genreFamilyJumps}`);
    console.log(`repeatsAfterCooldown=${summary.longTermRepeats}`);
    console.log(`maxArtistStreak=${summary.maxConsecutiveArtist}`);
    console.log(`aiDirected=${summary.aiDirectedSelections} fallbackLadder=${summary.fallbackLadderSelections} lowFitDrops=${summary.lowFitDrops}`);
    console.log(`sources=${JSON.stringify(summary.sources)}`);
    console.log(`lanes=${JSON.stringify(summary.lanes)}`);
    if (summary.violations.length) console.log(`violations=${summary.violations.join("; ")}`);
  }

  if (!result.passed) process.exitCode = 1;
}

main();
