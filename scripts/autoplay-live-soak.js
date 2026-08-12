const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const envFile = process.env.AUTOPLAY_LIVE_ENV_FILE ||
  (fs.existsSync(path.resolve(".env")) ? ".env" : ".env.dev");
dotenv.config({ path: envFile });

const { runLiveAutoplaySoak } = require("../helpers/lavalink/autoplayLiveSoak");

function parseArgs(argv) {
  const args = { json: false, manualQueries: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--query") args.query = argv[++index];
    else if (value === "--manual-query") args.manualQueries.push(argv[++index]);
    else if (value === "--steps") args.steps = Number(argv[++index]);
    else if (value === "--delay-ms") args.delayMs = Number(argv[++index]);
    else if (value === "--json") args.json = true;
    else if (value === "--help" || value === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: pnpm test:autoplay:live -- --query "artist - title" [options]

Runs the real autoplay pipeline against local Lavalink without joining a voice channel
or adding anything to a Discord queue.

Options:
  --query <text>       Seed search resolved by local Lavalink (required)
  --steps <number>     Number of real autoplay fetch/resolve cycles (default: 10)
  --manual-query <text> Repeatable upcoming user-added track used as manual context
  --delay-ms <number>  Delay between cycles to avoid provider rate limits
  --json               Print the complete trace as JSON
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.query) {
    printHelp();
    if (!args.help) process.exitCode = 1;
    return;
  }

  const result = await runLiveAutoplaySoak({
    query: args.query,
    manualQueries: args.manualQueries,
    steps: args.steps || 10,
    delayMs: args.delayMs || 0,
  });

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Live autoplay soak ${result.passed ? "PASSED" : "FAILED"}`);
    console.log(`seed=${result.seed.artist} - ${result.seed.title}`);
    console.log(`cycles=${result.metrics.completedSteps}/${result.metrics.completedSteps + result.metrics.unresolvedSteps}`);
    console.log(
      `unresolved=${result.metrics.unresolvedSteps} resolutionFailures=${result.metrics.resolutionFailures} ` +
      `duplicates=${result.metrics.duplicateSelections} longTermRepeats=${result.metrics.longTermRepeats}`
    );
    console.log(`genreJumps=${result.metrics.genreFamilyJumps} maxArtistStreak=${result.metrics.maxConsecutiveArtist}`);
    console.log(`artistWindowViolations=${result.metrics.artistWindowViolations}`);
    console.log(
      `continuity=tempo(avg:${result.metrics.continuity.tempo.average ?? "n/a"},max:${result.metrics.continuity.tempo.max ?? "n/a"}) ` +
      `energy(avg:${result.metrics.continuity.energy.average ?? "n/a"},max:${result.metrics.continuity.energy.max ?? "n/a"}) ` +
      `bridge(avg:${result.metrics.continuity.averageBridgeStrength ?? "n/a"})`
    );
    console.log(`fallbacks=${result.metrics.fallbackSelections} weakEvidence=${result.metrics.weakEvidenceSelections}`);
    console.log(`sources=${JSON.stringify(result.metrics.sources)}`);
    console.log(
      `path=${[result.seed, ...result.steps.map((step) => step.selected).filter(Boolean)]
        .map((track) => `${track.artist} - ${track.title}`)
        .join(" → ")}`
    );
    if (result.violations.length) console.log(`violations=${result.violations.join("; ")}`);
    console.log("queue=not modified; voice channel=not joined");
  }

  if (!result.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Live autoplay soak failed to start: ${error.message}`);
  process.exitCode = 1;
});
