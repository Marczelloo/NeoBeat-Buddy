import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "..",
);
const sourceDir = mkdtempSync(join(tmpdir(), "mewbit-youtube-source-"));
const pluginsDir = join(repositoryRoot, "helpers", "lavalink", "plugins");
const tvSource = join(
  sourceDir,
  "common",
  "src",
  "main",
  "java",
  "dev",
  "lavalink",
  "youtube",
  "clients",
  "Tv.java",
);
const rejectedUserAgent = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version";
const ps4UserAgent = "Mozilla/5.0 (PlayStation; PlayStation 4/12.00)";

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

run("git", [
  "clone",
  "--depth",
  "1",
  "--branch",
  "1.18.2",
  "https://github.com/lavalink-devs/youtube-source.git",
  sourceDir,
]);

const original = readFileSync(tvSource, "utf8");
if (!original.includes(rejectedUserAgent)) {
  throw new Error("The expected TV user-agent was not found; aborting the patch.");
}
writeFileSync(tvSource, original.replace(rejectedUserAgent, ps4UserAgent));

const dockerSourceDir =
  process.platform === "win32" ? sourceDir.replaceAll("\\", "/") : sourceDir;
run("docker", [
  "run",
  "--rm",
  "-v",
  `${dockerSourceDir}:/src`,
  "-w",
  "/src",
  "gradle:8.10-jdk21",
  "bash",
  "./gradlew",
  ":plugin:build",
  "--no-daemon",
]);

const outputDir = join(sourceDir, "plugin", "build", "libs");
const builtJar = readdirSync(outputDir).find(
  (file) => file.startsWith("youtube-plugin-") && file.endsWith(".jar"),
);
if (!builtJar) {
  throw new Error("youtube-source build completed without a plugin JAR.");
}

mkdirSync(pluginsDir, { recursive: true });
const target = join(pluginsDir, "youtube-plugin-1.18.2.jar");
if (existsSync(target)) {
  copyFileSync(target, `${target}.backup-before-tv-ps4-ua`);
}
copyFileSync(join(outputDir, builtJar), target);
console.log(`Installed ${basename(target)} with the PS4 TV user-agent patch.`);
