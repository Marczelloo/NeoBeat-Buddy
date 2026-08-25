const { inspect } = require("util");
const Log = require("../logs/log");
const { AUTOPLAY_RESOLVE_TIMEOUT_MS, MAX_FALLBACK_ATTEMPTS } = require("./constants");
const { withTimeout } = require("./resolveTimeout");
const { filterPlayableSearchResults, rankSearchResults } = require("./searchRanking");
const {
  cleanArtistName,
  cleanTrackMetadata,
  getBaseTitle,
  getVariantKinds,
  normalizeComparableText,
} = require("./trackNormalization");

const isAutoplayTrack = (track) => Boolean(track?.info?.autoplayed || track?.userData?.autoplay);

const describeTrack = (track) => {
  if (!track) return "unknown";
  const info = track.info || {};
  return `${info.title || info.identifier || "unknown"} [${info.identifier || "n/a"}]`;
};

const copyRequesterMetadata = (source = {}, target = {}) => {
  ["requester", "requesterId", "requesterTag", "requesterAvatar", "loop"].forEach((key) => {
    if (source[key] !== undefined) target[key] = source[key];
  });
  return target;
};

const buildFallbackQueries = (info = {}) => {
  const seen = new Set();
  const queries = [];
  const push = (source, query) => {
    const trimmed = (query || "").trim();
    if (!trimmed) return;
    const key = `${source}:${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ source, query: trimmed });
  };

  const author = info.author && info.author !== "Unknown" ? info.author : "";
  // Keep the same resolution order as LavaSrc's Spotify mirror chain. ISRC
  // is provider-neutral and avoids turning an unavailable Spotify recording
  // into an unrelated title/artist search result.
  if (info.isrc) {
    push("ytsearch", info.isrc);
    push("ytmsearch", info.isrc);
  }

  const identityQuery = [info.title, author].filter(Boolean).join(" ");
  push("ytmsearch", identityQuery);
  push("ytsearch", identityQuery);
  push("scsearch", identityQuery);

  return queries;
};

function normalizeIsrc(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getTrackIdentityMetadata(trackOrInfo = {}) {
  const info = trackOrInfo.info || trackOrInfo;
  const { cleanTitle, searchArtist } = cleanTrackMetadata(info.title, info.author);

  return {
    title: getBaseTitle(cleanTitle || info.title),
    artist: normalizeComparableText(cleanArtistName(searchArtist || info.author)),
    isrc: normalizeIsrc(info.isrc || trackOrInfo.isrc || trackOrInfo.pluginInfo?.isrc),
    variants: getVariantKinds(info.title),
    duration: Number(info.length || trackOrInfo.length || 0),
  };
}

function hasArtistMatch(expected, candidate) {
  if (!expected || !candidate) return false;
  if (expected === candidate || expected.includes(candidate) || candidate.includes(expected)) return true;

  const expectedTokens = new Set(expected.split(" ").filter(Boolean));
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  let overlap = 0;
  for (const token of expectedTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }

  // Require all meaningful tokens for short artist names and enough coverage
  // for collaborations such as "Kubi Producent, Young Multi, AG".
  return overlap >= Math.max(1, Math.ceil(expectedTokens.size * 0.67));
}

function sameVariantLane(expected, candidate) {
  const expectedVariants = new Set(expected.variants);
  const candidateVariants = new Set(candidate.variants);
  if (!expectedVariants.size) return candidateVariants.size === 0;
  return [...expectedVariants].every((variant) => candidateVariants.has(variant));
}

function isVerifiedFallbackMatch(failedTrack, candidateTrack) {
  const expected = getTrackIdentityMetadata(failedTrack);
  const candidate = getTrackIdentityMetadata(candidateTrack);

  if (!expected.title || !expected.artist || !candidate.title || !candidate.artist) {
    return { valid: false, reason: "missing canonical title or artist" };
  }

  if (expected.isrc && candidate.isrc && expected.isrc !== candidate.isrc) {
    return { valid: false, reason: "ISRC mismatch" };
  }

  if (expected.title !== candidate.title) {
    return { valid: false, reason: "title mismatch" };
  }

  if (!hasArtistMatch(expected.artist, candidate.artist)) {
    return { valid: false, reason: "artist mismatch" };
  }

  if (!sameVariantLane(expected, candidate)) {
    return { valid: false, reason: "version mismatch" };
  }

  if (expected.duration > 0 && candidate.duration > 0) {
    const difference = Math.abs(expected.duration - candidate.duration);
    const allowedDifference = Math.max(12_000, Math.min(30_000, expected.duration * 0.1));
    if (difference > allowedDifference) {
      return { valid: false, reason: `duration mismatch (${difference}ms)` };
    }
  }

  return { valid: true, reason: expected.isrc && candidate.isrc ? "ISRC match" : "identity match" };
}

async function tryQueueFallbackTrack(player, failedTrack) {
  const poru = player?.poru;
  if (!failedTrack || !poru) return null;

  const info = failedTrack.info || {};
  failedTrack.userData = { ...(failedTrack.userData || {}) };
  const previousAttempts = failedTrack.userData.fallbackAttempts || 0;

  if (previousAttempts >= MAX_FALLBACK_ATTEMPTS) {
    Log.warning("Fallback attempts exhausted", "", `guild=${player.guildId}`, `track=${describeTrack(failedTrack)}`);
    return null;
  }

  const queries = buildFallbackQueries(info);
  if (!queries.length) {
    Log.warning("No fallback query candidates", "", `guild=${player.guildId}`, `track=${describeTrack(failedTrack)}`);
    failedTrack.userData.fallbackAttempts = previousAttempts + 1;
    return null;
  }

  for (const { source, query } of queries) {
    try {
      const response = await withTimeout(
        poru.resolve({ query, source }),
        AUTOPLAY_RESOLVE_TIMEOUT_MS,
        `Fallback ${source} resolver (${query})`
      );
      const validTracks = (response?.tracks || []).filter((t) => t?.track && t?.info);
      const rankedTracks = rankSearchResults(filterPlayableSearchResults(validTracks, query), query);
      const verified = rankedTracks
        .map((candidate) => ({ candidate, verification: isVerifiedFallbackMatch(failedTrack, candidate) }))
        .find(({ verification }) => verification.valid);
      const fallbackTrack = verified?.candidate;

      if (!fallbackTrack) {
        const reason = rankedTracks.length
          ? isVerifiedFallbackMatch(failedTrack, rankedTracks[0]).reason
          : "no relevant results";
        Log.info(
          "Fallback rejected unverified mirror",
          `source=${source}`,
          `query=${query}`,
          `reason=${reason}`,
          `guild=${player.guildId}`
        );
        continue;
      }

      const fallbackInfo = copyRequesterMetadata(info, fallbackTrack.info || (fallbackTrack.info = {}));
      if (fallbackInfo.identifier && info.identifier && fallbackInfo.identifier === info.identifier) continue;

      fallbackTrack.userData = {
        ...(fallbackTrack.userData || {}),
        fallbackParent: describeTrack(failedTrack),
        fallbackAttempts: previousAttempts + 1,
        autoplay: isAutoplayTrack(failedTrack),
        manual: !isAutoplayTrack(failedTrack),
      };
      fallbackTrack.info = {
        ...(fallbackTrack.info || {}),
        autoplayed: isAutoplayTrack(failedTrack),
      };

      player.queue.unshift(fallbackTrack);
      failedTrack.userData.fallbackAttempts = previousAttempts + 1;

      const fromTitle = failedTrack?.info?.title || "Unknown";
      const toTitle = fallbackTrack?.info?.title || "Unknown";

      Log.info(
        "🔄 Fallback queued",
        `from=${fromTitle}`,
        `to=${toTitle}`,
        `source=${source}`,
        `queue=${player.queue.length}`,
        `guild=${player.guildId}`
      );

      return fallbackTrack;
    } catch (fallbackErr) {
      const summary = fallbackErr instanceof Error ? fallbackErr.message : inspect(fallbackErr, { depth: 1 });
      Log.warning(
        "⚠️ Fallback failed",
        `query=${query}`,
        `source=${source}`,
        `error=${summary}`,
        `guild=${player.guildId}`
      );
    }
  }

  failedTrack.userData.fallbackAttempts = previousAttempts + 1;
  return null;
}

module.exports = {
  tryQueueFallbackTrack,
  describeTrack,
  buildFallbackQueries,
  copyRequesterMetadata,
  getTrackIdentityMetadata,
  isVerifiedFallbackMatch,
};
