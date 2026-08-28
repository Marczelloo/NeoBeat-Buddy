const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { planNextTrackWithAIDJ } = require("./aiDj");
const { enrichManualAnchorTracks } = require("./autoplayCandidates");
const {
  applyCandidateMetadata,
  collectCandidates,
  getAutoplayReference,
  resolveToPlayable,
} = require("./autoplayCandidates");
const { getExposureKey, getAutoplayExposureSnapshot } = require("./autoplayExposure");
const { getGenreFamilies } = require("./genreUtils");
const { getLastFmTagProfile } = require("./lastfmClient");
const { buildSessionProfile, getTrackMetadata, isAutoplayTrack } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const { cloneTrack, ensurePlaybackState, playbackState } = require("./state");
const { hasTrackIdentity } = require("./trackIdentity");
const { cleanArtistName, normalizeComparableText } = require("./trackNormalization");
const { isValidSong } = require("./trackValidation");

function artistKey(value) {
  return normalizeComparableText(cleanArtistName(value || ""));
}

// Emergency caps for the deterministic fallback ladder only. The AI director
// is trusted to judge artist/album runs adaptively (a distinctive artist may
// carry a long run; a generic one should rotate quickly), so these caps never
// apply to ai_dj candidates.
const MAX_CONSECUTIVE_ALBUM_TRACKS = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ALBUM_STREAK ?? 2), 1);
const MAX_CONSECUTIVE_ARTIST_TRACKS = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ARTIST_STREAK ?? 3), 1);
const MAX_ALBUM_CONTINUITY_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ALBUM_CONTINUITY_STREAK ?? 3), MAX_CONSECUTIVE_ALBUM_TRACKS);
const MAX_ARTIST_CONTINUITY_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ARTIST_CONTINUITY_STREAK ?? 6), MAX_CONSECUTIVE_ARTIST_TRACKS);
const REPEAT_COOLDOWN_MS = Math.max(Number(process.env.AUTOPLAY_REPEAT_COOLDOWN_MS ?? 60 * 60 * 1000), 0);
const SOFT_ARTIST_EXIT_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_SOFT_ARTIST_STREAK ?? 4), 1);
const SOFT_ALBUM_EXIT_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_SOFT_ALBUM_STREAK ?? 3), 1);

// AI selection tuning.
const AI_DJ_MIN_FIT = Number(process.env.AI_DJ_MIN_FIT ?? 55);
const AI_DJ_FIT_BAND = Math.min(Math.max(Number(process.env.AI_DJ_DIVERSITY_FIT_BAND ?? 10), 0), 30);
const AI_DJ_SKIP_DEMOTION = Math.max(Number(process.env.AI_DJ_SKIP_DEMOTION ?? 12), 0);

function sourceSet(candidate) {
  return new Set([candidate?.source, ...(candidate?.providerSources || [])].filter(Boolean));
}

function albumKey(track) {
  const metadata = getTrackMetadata(track);
  const id = metadata.albumId || track?.userData?.albumId;
  if (id) return `id:${id}`;
  const title = metadata.albumTitle || track?.userData?.albumTitle || track?.info?.albumName;
  const artist = artistKey(track?.userData?.autoplayReference?.artist || track?.info?.author);
  return title ? `text:${artist}|${normalizeAlbumTitle(title)}` : null;
}

function normalizeAlbumTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/\b(?:deluxe|expanded|remaster(?:ed)?|edition)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function candidateAlbumKey(candidate) {
  if (candidate?.albumId) return `id:${candidate.albumId}`;
  if (!candidate?.albumTitle && !candidate?.album) return null;
  return `text:${artistKey(candidate.artist)}|${normalizeAlbumTitle(candidate.albumTitle || candidate.album)}`;
}

function consecutiveCount(tracks, predicate) {
  let count = 0;
  for (let index = tracks.length - 1; index >= 0; index -= 1) {
    if (!predicate(tracks[index])) break;
    count += 1;
  }
  return count;
}

function getRecentTracks(profile, referenceTrack) {
  // `history` is populated by player events and some provider track shapes can
  // arrive without the encoded `track` field used by that event path. The
  // dedicated autoplay history is populated for every accepted autoplay pick,
  // so combine both histories before calculating continuity limits.
  const tracks = [
    ...(profile.recentTracks || []),
    ...(profile.recentAutoplayTracks || []),
    referenceTrack,
  ].filter(Boolean);
  const seen = new Set();
  return tracks.filter((track) => {
    const key = getExposureKey(track) || `${track?.info?.identifier || ""}|${track?.info?.title || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAnchorTrack(guildId, referenceTrack) {
  const state = ensurePlaybackState(guildId);
  const manual = !isAutoplayTrack(referenceTrack);

  if (manual) {
    state.autoplayV3 = { anchor: cloneTrack(referenceTrack), updatedAt: Date.now() };
  } else if (!state.autoplayV3?.anchor) {
    const lastManual = [...(state.manualHistory || [])].reverse().find((track) => !isAutoplayTrack(track));
    state.autoplayV3 = { anchor: cloneTrack(lastManual || referenceTrack), updatedAt: Date.now() };
  }

  playbackState.set(guildId, state);
  return state.autoplayV3?.anchor || referenceTrack;
}

async function enrichAnchorGenres(anchorTrack) {
  if (!anchorTrack?.info) return anchorTrack;
  const metadata = getTrackMetadata(anchorTrack);
  if (metadata.genres.length) return anchorTrack;

  const reference = getAutoplayReference(anchorTrack);
  const tags = await getLastFmTagProfile({ artist: reference.searchArtist, title: reference.cleanTitle, limit: 10 }).catch(() => null);
  if (!tags?.tags?.length) return anchorTrack;

  anchorTrack.userData = {
    ...(anchorTrack.userData || {}),
    autoplayReference: { title: reference.cleanTitle, artist: reference.searchArtist },
    genres: tags.tags,
    metadataConfidence: tags.confidence || 0,
    metadataProvider: tags.source || "lastfm",
  };
  return anchorTrack;
}

function hasRecentExposure(candidate, profile, exposure, referenceTrack = null, now = Date.now()) {
  const key = getExposureKey(candidate);
  if (!key) return false;
  if (referenceTrack && getExposureKey(referenceTrack) === key) return true;
  const inSession = (profile.cooldownTracks || []).some((track) => {
    if (getExposureKey(track) !== key) return false;
    const playedAt = Number(track?.userData?.autoplayPlayedAt);
    return !Number.isFinite(playedAt) || now - playedAt < REPEAT_COOLDOWN_MS;
  });
  const remembered = (exposure?.tracks || []).some((entry) => entry.key === key && now - Number(entry.lastSeen || 0) < REPEAT_COOLDOWN_MS);
  return inSession || remembered;
}

function candidateIdentityKey(candidate) {
  return getExposureKey(candidate) || `${artistKey(candidate?.artist)}|${String(candidate?.title || "").toLowerCase()}`;
}

/**
 * Builds the shared selection context used by both the AI path and the
 * deterministic fallback ladder.
 */
function buildSelectionContext({ profile, exposure, referenceTrack, recentTracks, skipPatterns, anchorTrack, blockedTracks = [] }) {

  const referenceMetadata = getTrackMetadata(referenceTrack);
  const anchorMetadata = getTrackMetadata(anchorTrack || referenceTrack);
  const referenceArtist = artistKey(referenceTrack.userData?.autoplayReference?.artist || referenceTrack.info?.author);
  const referenceAlbum = albumKey(referenceTrack);

  return {
    profile,
    exposure: exposure || profile?.autoplayExposure || null,
    referenceTrack,
    referenceArtist,
    referenceAlbum,
    referenceFamilies: getGenreFamilies(referenceMetadata.genres),
    // Advisory only: the AI director sees these but nothing is hard-rejected
    // on their basis anymore. The fallback ladder still weights them softly.
    anchorFamilies: getGenreFamilies(anchorMetadata.genres),
    artistStreak: consecutiveCount(recentTracks, (track) => artistKey(track.userData?.autoplayReference?.artist || track.info?.author) === referenceArtist),
    albumStreak: referenceAlbum ? consecutiveCount(recentTracks, (track) => albumKey(track) === referenceAlbum) : 0,
    skippedArtists: new Set(Object.keys(skipPatterns?.skippedArtists || {}).map(artistKey)),
    skippedArtistCounts: Object.entries(skipPatterns?.skippedArtists || {})
      .map(([artist, skips]) => ({ artist, skips: Number(skips) || 0 }))
      .sort((left, right) => right.skips - left.skips),
    recentSkips: (skipPatterns?.recentSkips || [])
      .slice(-6)
      .reverse()
      .map((skip) => ({
        artist: cleanArtistName(skip.artist),
        title: skip.title,
        reason: skip.reason === "manual"
          ? "listener-skip"
          : skip.reason === "autoplay_replace"
            ? "listener-rejected queued pick"
            : skip.reason,
      })),
    blockedTracks: blockedTracks.filter(Boolean).slice(-6),
    repeatCooldownMs: REPEAT_COOLDOWN_MS,
  };
}

/**
 * Filters the director's proposals down to factual violations only:
 * duplicates, cooldown repeats, and per-candidate minimum fit. Taste-level
 * guards (genre families, streak caps) deliberately do not apply to AI picks -
 * the model was explicitly asked to judge runs and bridges adaptively.
 */
function filterAICandidates(candidates, context, { minFit = AI_DJ_MIN_FIT, now = Date.now() } = {}) {
  const rejected = {};
  const seen = new Set();
  const accepted = [];

  for (const candidate of candidates) {
    const identity = candidateIdentityKey(candidate);
    if (!identity || seen.has(identity)) {
      rejected["duplicate-candidate"] = (rejected["duplicate-candidate"] || 0) + 1;
      continue;
    }
    seen.add(identity);

    if (hasRecentExposure(candidate, context.profile, context.exposure, context.referenceTrack, now)) {
      rejected["recent-duplicate"] = (rejected["recent-duplicate"] || 0) + 1;
      continue;
    }

    if (hasTrackIdentity(context.blockedTracks || [], candidate, { includeIdentifier: false })) {
      rejected["listener-rejected"] = (rejected["listener-rejected"] || 0) + 1;
      continue;
    }

    if (Number.isFinite(Number(candidate.aiDjFit)) && Number(candidate.aiDjFit) < minFit) {
      rejected["low-fit"] = (rejected["low-fit"] || 0) + 1;
      continue;
    }

    const sameArtist = Boolean(artistKey(candidate.artist) && artistKey(candidate.artist) === context.referenceArtist);
    const sameAlbum = Boolean(candidateAlbumKey(candidate) && candidateAlbumKey(candidate) === context.referenceAlbum);
    accepted.push({
      candidate,
      score: Number(candidate.aiDjFit) || 0,
      details: { sameArtist, sameAlbum },
    });
  }

  return { ranked: accepted, rejected };
}

/**
 * Orders AI candidates with fit as the dominant signal, plus two soft nudges:
 * a weighted-random draw inside the top fit band (less deterministic than
 * always taking #1) and a gentle bridge preference once a run is long enough
 * that even the model's own continuation should start competing with its
 * equally-credible exit plan.
 */
function orderAIDirectorCandidates(ranked, context, random = Math.random) {
  if (!ranked.length) return { ranked, deferred: null };

  // Fit-first ordering: the weighted draw happens around the strongest
  // proposal regardless of the order the model happened to emit them in
  // (rank breaks ties so the director's own sequence still matters there).
  const orderedByFit = [...ranked]
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      const fitDelta = (Number(right.entry.candidate.aiDjFit) || 0) - (Number(left.entry.candidate.aiDjFit) || 0);
      if (fitDelta) return fitDelta;
      return (Number(left.entry.candidate.aiDjRank) || 0) - (Number(right.entry.candidate.aiDjRank) || 0);
    })
    .map(({ entry }) => entry);

  const fits = orderedByFit.map((entry) => Number(entry.candidate.aiDjFit) || 0);
  const bestIndex = 0;
  const bestFit = fits[bestIndex];
  const primaryDetails = orderedByFit[bestIndex].details;

  // The longer a same-artist/same-album run drags past its soft threshold,
  // the wider the rotation band and the stronger the bridge pull grows. This
  // stays soft - the director's best pick can still win a fair roll - but an
  // endless run of interchangeable tracks keeps losing altitude.
  const artistExitSteps = Math.max(0, context.artistStreak - SOFT_ARTIST_EXIT_STREAK);
  const albumExitSteps = Math.max(0, context.albumStreak - SOFT_ALBUM_EXIT_STREAK);
  const exitDepth = Math.max(artistExitSteps, albumExitSteps);
  const band = AI_DJ_FIT_BAND + Math.min(exitDepth * 4, 12);
  const exitMultiplier = artistExitSteps + albumExitSteps > 0 ? 1.5 + exitDepth * 0.5 : 0;
  const artistExitWanted = primaryDetails.sameArtist && artistExitSteps > 0;
  const albumExitWanted = primaryDetails.sameAlbum && albumExitSteps > 0;

  const skipCounts = new Map(
    (context.skippedArtistCounts || []).map((entry) => [artistKey(entry.artist), entry.skips])
  );

  const pool = orderedByFit
    .map((entry, index) => {
      const fit = fits[index];
      if (fit < bestFit - band) return null;
      const lane = String(entry.candidate.aiDjLane || "").toLowerCase();
      const sameArtist = entry.details.sameArtist;
      const sameAlbum = entry.details.sameAlbum;
      let weight = Math.max(fit - (bestFit - band) + 1, 1);

      if ((artistExitWanted || albumExitWanted) && lane !== "continuation" && !sameArtist && !sameAlbum) {
        weight *= exitMultiplier;
      }
      const preferredLanes = context.selectionIntent?.preferredLanes || [];
      const preferredIndex = preferredLanes.indexOf(lane);
      if (preferredIndex === 0) weight *= 1.9;
      else if (preferredIndex === 1) weight *= 1.3;
      if (context.selectionIntent?.mode === "popular") {
        weight *= 1 + Math.min(Math.max(Number(entry.candidate.popularity) || 0, 0), 100) / 125;
      }
      const skips = skipCounts.get(artistKey(entry.candidate.artist)) || 0;
      if (skips > 0) weight /= 1 + (AI_DJ_SKIP_DEMOTION / 100) * Math.min(skips, 3);

      return { entry, index, fit, weight };
    })
    .filter(Boolean);

  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  const roll = Math.min(Math.max(Number(random()) || 0, 0), 0.999999) * totalWeight;
  let cursor = 0;
  let chosen = pool[0];
  for (const item of pool) {
    cursor += item.weight;
    if (roll < cursor) {
      chosen = item;
      break;
    }
  }

  const rest = orderedByFit
    .filter((_, index) => index !== chosen.index)
    .sort((left, right) => {
      const fitDelta = (Number(right.candidate.aiDjFit) || 0) - (Number(left.candidate.aiDjFit) || 0);
      if (fitDelta) return fitDelta;
      return (Number(left.candidate.aiDjRank) || 0) - (Number(right.candidate.aiDjRank) || 0);
    });

  const deferred = chosen.index === bestIndex
    ? null
    : {
        artist: orderedByFit[bestIndex].candidate.artist,
        title: orderedByFit[bestIndex].candidate.title,
        fit: orderedByFit[bestIndex].candidate.aiDjFit,
        forArtist: chosen.entry.candidate.artist,
        forTitle: chosen.entry.candidate.title,
        forFit: chosen.entry.candidate.aiDjFit,
        route: String(chosen.entry.candidate.aiDjLane || "band-roll"),
      };

  return { ranked: [chosen.entry, ...rest], deferred };
}

function hasStrongContinuation(candidate, context) {
  const candidateArtist = artistKey(candidate.artist);
  const candidateAlbum = candidateAlbumKey(candidate);
  const sameArtist = candidateArtist && candidateArtist === context.referenceArtist;
  const sameAlbum = candidateAlbum && candidateAlbum === context.referenceAlbum;
  if (!sameArtist && !sameAlbum) return false;

  const sources = sourceSet(candidate);
  return (sameAlbum && sources.has("same_album"))
    || (sameArtist && sources.has("lastfm_similar") && Number(candidate.similarity) >= 0.7)
    || (sameArtist && sources.has("deezer_recommendations"));
}

function scoreCandidateV3(candidate, context) {
  const sources = sourceSet(candidate);
  const candidateGenres = getGenreFamilies(candidate.genres || []);
  const candidateArtist = artistKey(candidate.artist);
  const candidateAlbum = candidateAlbumKey(candidate);
  const sameArtist = candidateArtist && candidateArtist === context.referenceArtist;
  const sameAlbum = candidateAlbum && candidateAlbum === context.referenceAlbum;
  const similarity = Number(candidate.similarity) || 0;
  const chartRelation = 18
    + Math.round(Math.max(0, Math.min(100, Number(candidate.popularity) || 0)) / 10)
    + Math.max(0, 10 - Math.min(10, Number(candidate.chartPosition) || 10));
  // A flat priority ladder, highest-confidence lane first. Written as one
  // chain rather than a nested-looking one: the indentation used to imply
  // deezer_chart sat under youtube_mix, which is not how this parses.
  const relation =
    sources.has("lastfm_similar") ? 40 + Math.round(similarity * 10)
    : sources.has("same_album") ? 44
    : sources.has("deezer_recommendations") ? 34 + Math.round(similarity * 10)
    : sources.has("youtube_mix") ? 30
    : sources.has("deezer_chart") ? chartRelation
    : 0;

  // The current transition matters more than the session-opening manual
  // anchor, which may be hours stale by now.
  const anchorMatch = context.anchorFamilies.length && candidateGenres.length
    ? candidateGenres.filter((genre) => context.anchorFamilies.includes(genre)).length / candidateGenres.length
    : 0;
  const referenceMatch = context.referenceFamilies.length && candidateGenres.length
    ? candidateGenres.filter((genre) => context.referenceFamilies.includes(genre)).length / candidateGenres.length
    : 0;
  const genreScore = Math.round(Math.min(1, referenceMatch * 0.7 + anchorMatch * 0.3) * 30);
  const continuationDepth = sameAlbum ? Math.max(context.albumStreak, context.artistStreak) : context.artistStreak;
  const softCap = sameAlbum ? MAX_CONSECUTIVE_ALBUM_TRACKS : MAX_CONSECUTIVE_ARTIST_TRACKS;
  const continuationScore = sameAlbum ? 12 : sameArtist ? 8 : 0;
  const continuationPenalty = Math.max(0, continuationDepth - softCap + 1) * (sameAlbum ? 3 : 4);
  const diversityScore = sameArtist ? 0 : 6;
  const softArtistExitPenalty = 3;
  const softAlbumExitPenalty = 4;
  const artistExitSteps = sameArtist ? Math.max(0, context.artistStreak - SOFT_ARTIST_EXIT_STREAK + 1) : 0;
  const albumExitSteps = sameAlbum ? Math.max(0, context.albumStreak - SOFT_ALBUM_EXIT_STREAK + 1) : 0;
  const softExitPenalty = artistExitSteps * softArtistExitPenalty + albumExitSteps * softAlbumExitPenalty;

  return {
    candidate,
    score: relation + genreScore + continuationScore + diversityScore - continuationPenalty - softExitPenalty,
    details: {
      relation,
      genreScore,
      continuationScore,
      continuationPenalty,
      softExitPenalty,
      diversityScore,
      sameArtist,
      sameAlbum,
    },
  };
}

/**
 * Deterministic emergency ladder used only when the AI director is disabled,
 * times out, or returns no usable plan. Relation-first, fact-gated: dedupe,
 * cooldown, skipped artists, and simple continuity caps.
 */
function selectFallbackCandidates(candidates, context) {
  const accepted = [];
  const rejected = {};
  const seen = new Set();
  const bump = (reason) => { rejected[reason] = (rejected[reason] || 0) + 1; };

  for (const candidate of candidates) {
    const identity = candidateIdentityKey(candidate);
    if (!identity || seen.has(identity)) {
      bump("duplicate-candidate");
      continue;
    }
    seen.add(identity);

    const sources = sourceSet(candidate);
    const isAllowedChartFallback = Boolean(context.allowChartFallback && sources.has("deezer_chart"));
    if (!isAllowedChartFallback && !sources.has("lastfm_similar") && !sources.has("youtube_mix") && !sources.has("same_album") && !sources.has("deezer_recommendations")) {
      bump("unrelated-source");
      continue;
    }
    if (hasRecentExposure(candidate, context.profile, context.exposure, context.referenceTrack)) {
      bump("recent-duplicate");
      continue;
    }
    if (hasTrackIdentity(context.blockedTracks || [], candidate, { includeIdentifier: false })) {
      bump("listener-rejected");
      continue;
    }

    const candidateArtist = artistKey(candidate.artist);
    if (candidateArtist && context.skippedArtists.has(candidateArtist)) {
      bump("skipped-artist");
      continue;
    }
    const strongContinuation = hasStrongContinuation(candidate, context);
    if (candidateArtist && candidateArtist === context.referenceArtist && context.artistStreak >= MAX_CONSECUTIVE_ARTIST_TRACKS) {
      if (!strongContinuation) {
        bump("artist-streak");
        continue;
      }
      if (context.artistStreak >= MAX_ARTIST_CONTINUITY_STREAK) {
        bump("artist-continuity-limit");
        continue;
      }
    }
    const candidateAlbum = candidateAlbumKey(candidate);
    if (candidateAlbum && candidateAlbum === context.referenceAlbum && context.albumStreak >= MAX_CONSECUTIVE_ALBUM_TRACKS) {
      if (!strongContinuation) {
        bump("album-streak");
        continue;
      }
      if (context.albumStreak >= MAX_ALBUM_CONTINUITY_STREAK) {
        bump("album-continuity-limit");
        continue;
      }
    }
    accepted.push(scoreCandidateV3(candidate, context));
  }

  return { ranked: accepted.sort((left, right) => right.score - left.score), rejected };
}

function getVerifiedCatalogMatch(proposal, catalogCandidates) {
  return (catalogCandidates || []).find((candidate) =>
    hasTrackIdentity([candidate?.track || candidate], proposal, { includeIdentifier: false })
  ) || null;
}

function buildAIDJCandidates(aiResult, catalogCandidates = []) {
  if (aiResult?.status !== "planned" || !Array.isArray(aiResult.plan?.candidates)) return [];

  return aiResult.plan.candidates.map((proposal, index) => {
    const verified = getVerifiedCatalogMatch(proposal, catalogCandidates);
    return {
    ...(verified || {}),
    artist: verified?.artist || verified?.track?.info?.author || proposal.artist,
    title: verified?.title || verified?.track?.info?.title || proposal.title,
    albumTitle: verified?.albumTitle || verified?.track?.userData?.albumTitle || proposal.album || null,
    source: "ai_dj",
    providerSources: ["ai_dj", ...(verified?.providerSources || []), verified?.source].filter(Boolean),
    genres: verified?.genres || [],
    similarity: null,
    aiDjRank: index,
    aiDjFit: proposal.fit,
    aiDjLane: proposal.lane,
    aiDjEnergy: proposal.energy,
    aiDjMood: proposal.mood,
    aiDjVerifiedCatalog: Boolean(verified),
    aiDJ: {
      model: aiResult.model || null,
      confidence: aiResult.plan.confidence,
      direction: aiResult.plan.direction,
      reasons: aiResult.plan.reasons,
      lane: proposal.lane,
      fit: proposal.fit,
      energy: proposal.energy,
      mood: proposal.mood,
      proposalReason: proposal.reason,
      cached: Boolean(aiResult.cached),
    },
  };
  });
}

function isPlayableFullTrack(track, guildId) {
  if (!track) return false;
  if (isValidSong(track.info, { allowStreams: false, strictDuration: true, excludeInterludes: true })) return true;
  Log.info(
    "Autoplay resolved track rejected as an album break",
    "",
    `guild=${guildId}`,
    `track=${track.info?.author || "Unknown"} - ${track.info?.title || "Unknown"}`
  );
  return false;
}

async function resolveV3Candidates(ranked, guildId, referenceTrack, anchorTrack, context) {
  for (const entry of ranked) {
    const aiDirected = sourceSet(entry.candidate).has("ai_dj");
    const resolved = await resolveToPlayable(entry.candidate, guildId, {
      referenceTitle: referenceTrack.info?.title || "",
      providerSources: aiDirected && !entry.candidate.track ? ["youtube", "deezer", "soundcloud", "spotify"] : null,
      debugLabel: aiDirected ? `ai-dj:${entry.candidate.artist} - ${entry.candidate.title}` : "v3-candidate",
    });
    if (!isPlayableFullTrack(resolved, guildId)) continue;
    const track = resolved;
    applyCandidateMetadata(track, entry.candidate);
    if (hasRecentExposure(track, context.profile, context.exposure, context.referenceTrack)) {
      Log.info("Autoplay resolved track rejected as a cross-provider repeat", "", `guild=${guildId}`, `track=${track.info?.author || "Unknown"} - ${track.info?.title || "Unknown"}`);
      continue;
    }
    if (hasTrackIdentity(context.blockedTracks || [], track, { includeIdentifier: false })) {
      Log.info("Autoplay resolved track rejected after listener replaced the pick", "", `guild=${guildId}`, `track=${track.info?.author || "Unknown"} - ${track.info?.title || "Unknown"}`);
      continue;
    }
    track.userData = {
      ...(track.userData || {}),
      autoplayV3: true,
      autoplayAnchor: { artist: anchorTrack.info?.author || "Unknown", title: anchorTrack.info?.title || "Unknown" },
      autoplayScore: entry.score,
      autoplayScoreDetails: entry.details,
      aiDJ: entry.candidate.aiDJ || null,
    };
    return { track, entry };
  }
  return null;
}

async function fetchAutoplayV3Track(referenceTrack, guildId, {
  pendingManualTracks = [],
  blockedTracks = [],
  allowWhenAutoplayDisabled = false,
  selectionIntent = null,
  mode = "normal",
} = {}) {
  if (!referenceTrack?.info) return null;
  if (!allowWhenAutoplayDisabled && !getGuildState(guildId)?.autoplay) return null;

  const startedAt = Date.now();
  const surpriseMode = mode === "surprise";
  // Surprise Me should answer from cached knowledge and a compact live pool,
  // not wait for the full prefetch enrichment pipeline.
  const anchorTrack = surpriseMode
    ? getAnchorTrack(guildId, referenceTrack)
    : await enrichAnchorGenres(getAnchorTrack(guildId, referenceTrack));
  if (!surpriseMode) await enrichManualAnchorTracks(pendingManualTracks, guildId);

  const profile = buildSessionProfile(guildId, referenceTrack, { pendingManualTracks });
  profile.autoplayExposure = await getAutoplayExposureSnapshot(guildId);
  profile.guildId = guildId;

  const recentTracks = getRecentTracks(profile, referenceTrack);
  const skipPatterns = getSkipPatterns(guildId);
  const context = buildSelectionContext({ profile, exposure: profile.autoplayExposure, referenceTrack, recentTracks, skipPatterns, anchorTrack, blockedTracks });
  context.selectionIntent = selectionIntent;
  // A chart pick is never a normal-autoplay fallback. It is only a safe,
  // verified escape hatch for Surprise me when personal context is too noisy
  // or the AI request times out.
  context.allowChartFallback = surpriseMode;
  const reference = getAutoplayReference(referenceTrack);
  const candidates = await collectCandidates(referenceTrack, guildId, profile, reference, {
    sources: surpriseMode
      ? ["deezer", "youtubeMix", "deezerChart"]
      : ["sameAlbum", "deezer", "lastfm", "youtubeMix"],
    enrichLastFmTags: !surpriseMode,
    enrichDeezerMetadata: surpriseMode ? false : undefined,
  });
  profile.verifiedCatalogCandidates = candidates;

  const aiResult = await planNextTrackWithAIDJ({ guildId, anchorTrack, referenceTrack, profile, context });
  const aiCandidates = buildAIDJCandidates(aiResult, candidates);

  let resolved = null;
  let aiOrdered = [];
  let aiDeferred = null;
  let aiRejected = {};

  if (aiCandidates.length) {
    const filtered = filterAICandidates(aiCandidates, context);
    aiRejected = filtered.rejected;
    const ordered = orderAIDirectorCandidates(filtered.ranked, context);
    aiOrdered = ordered.ranked;
    aiDeferred = ordered.deferred;
    resolved = await resolveV3Candidates(aiOrdered, guildId, referenceTrack, anchorTrack, context);
  }

  let fallbackRejected = {};
  let fallbackRanked = [];
  if (!resolved) {
    const { ranked, rejected } = selectFallbackCandidates(candidates, context);
    fallbackRanked = ranked;
    fallbackRejected = rejected;
    resolved = await resolveV3Candidates(ranked, guildId, referenceTrack, anchorTrack, context);
  }

  Log.info(
    "Autoplay V3 selection",
    "",
    `guild=${guildId}`,
    `mode=${mode}`,
    `elapsedMs=${Date.now() - startedAt}`,
    `anchor=${anchorTrack.info?.author || "Unknown"} - ${anchorTrack.info?.title || "Unknown"}`,
    `reference=${referenceTrack.info?.author || "Unknown"} - ${referenceTrack.info?.title || "Unknown"}`,
    `candidates=${candidates.length}`,
    `artistStreak=${context.artistStreak}`,
    `albumStreak=${context.albumStreak}`,
    `aiDj=${aiResult.status}${aiResult.plan ? `:${aiResult.plan.confidence}/${aiResult.plan.direction.summary}` : ""}`,
    `aiProposals=${aiCandidates.slice(0, 4).map((candidate) => `${candidate.artist} - ${candidate.title} [${candidate.aiDjLane};fit=${candidate.aiDjFit};e=${candidate.aiDjEnergy}]`).join(" | ") || "none"}`,
    `aiOrder=${aiOrdered.slice(0, 4).map((entry) => `${entry.candidate.artist} - ${entry.candidate.title} [${entry.candidate.aiDjLane};fit=${entry.candidate.aiDjFit}]`).join(" | ") || "none"}`,
    `aiDeferred=${aiDeferred ? `${aiDeferred.artist} - ${aiDeferred.title} [${aiDeferred.fit}]=>${aiDeferred.forArtist} - ${aiDeferred.forTitle} [${aiDeferred.forFit}]` : "none"}`,
    `aiRejected=${Object.entries(aiRejected).map(([key, value]) => `${key}:${value}`).join(",") || "none"}`,
    `fallbackEligible=${fallbackRanked.length}`,
    `fallbackRejected=${Object.entries(fallbackRejected).map(([key, value]) => `${key}:${value}`).join(",") || "none"}`,
    `winner=${resolved ? `${resolved.track.info?.author} - ${resolved.track.info?.title}${sourceSet(resolved.entry.candidate).has("ai_dj") ? ";ai-director" : ";fallback-ladder"}` : "none"}`
  );

  return resolved?.track || null;
}

module.exports = {
  AI_DJ_FIT_BAND,
  AI_DJ_MIN_FIT,
  MAX_ALBUM_CONTINUITY_STREAK,
  MAX_CONSECUTIVE_ALBUM_TRACKS,
  MAX_CONSECUTIVE_ARTIST_TRACKS,
  MAX_ARTIST_CONTINUITY_STREAK,
  REPEAT_COOLDOWN_MS,
  SOFT_ALBUM_EXIT_STREAK,
  SOFT_ARTIST_EXIT_STREAK,
  albumKey,
  artistKey,
  buildAIDJCandidates,
  buildSelectionContext,
  candidateIdentityKey,
  fetchAutoplayV3Track,
  filterAICandidates,
  getRecentTracks,
  hasRecentExposure,
  orderAIDirectorCandidates,
  resolveV3Candidates,
  scoreCandidateV3,
  selectFallbackCandidates,
};
