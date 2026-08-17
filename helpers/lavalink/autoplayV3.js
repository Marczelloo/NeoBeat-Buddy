const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { planNextTrackWithAIDJ } = require("./aiDj");
const { getAutoplayExposureSnapshot, getExposureKey } = require("./autoplayExposure");
const { areGenreFamiliesCompatible, getGenreFamilies } = require("./genreUtils");
const { getLastFmTagProfile } = require("./lastfmClient");
const { buildSessionProfile, getTrackMetadata, isAutoplayTrack } = require("./sessionProfile");
const { getSkipPatterns } = require("./skipLearning");
const {
  applyCandidateMetadata,
  collectCandidates,
  getAutoplayReference,
  resolveToPlayable,
} = require("./smartAutoplay");
const { cloneTrack, ensurePlaybackState, playbackState } = require("./state");
const { hasTrackIdentity } = require("./trackIdentity");
const { cleanArtistName, normalizeComparableText } = require("./trackNormalization");

const MAX_CONSECUTIVE_ALBUM_TRACKS = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ALBUM_STREAK ?? 2), 1);
const MAX_CONSECUTIVE_ARTIST_TRACKS = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ARTIST_STREAK ?? 3), 1);
const MAX_ALBUM_CONTINUITY_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ALBUM_CONTINUITY_STREAK ?? 3), MAX_CONSECUTIVE_ALBUM_TRACKS);
const MAX_ARTIST_CONTINUITY_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ARTIST_CONTINUITY_STREAK ?? 6), MAX_CONSECUTIVE_ARTIST_TRACKS);
const REPEAT_COOLDOWN_MS = Math.max(Number(process.env.AUTOPLAY_REPEAT_COOLDOWN_MS ?? 60 * 60 * 1000), 0);
const AI_DJ_MAX_CONSECUTIVE_ARTIST_TRACKS = Math.max(Number(process.env.AI_DJ_MAX_ARTIST_STREAK ?? 8), MAX_CONSECUTIVE_ARTIST_TRACKS);
const AI_DJ_MAX_CONSECUTIVE_ALBUM_TRACKS = Math.max(Number(process.env.AI_DJ_MAX_ALBUM_STREAK ?? 6), MAX_CONSECUTIVE_ALBUM_TRACKS);
const SOFT_ARTIST_EXIT_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_SOFT_ARTIST_STREAK ?? 4), 1);
const SOFT_ALBUM_EXIT_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_SOFT_ALBUM_STREAK ?? 3), 1);
const SOFT_ARTIST_EXIT_PENALTY = Math.max(Number(process.env.AUTOPLAY_V3_SOFT_ARTIST_EXIT_PENALTY ?? 3), 0);
const SOFT_ALBUM_EXIT_PENALTY = Math.max(Number(process.env.AUTOPLAY_V3_SOFT_ALBUM_EXIT_PENALTY ?? 4), 0);
const AI_DJ_PRIORITY_WEIGHT = Math.min(Math.max(Number(process.env.AI_DJ_PRIORITY_WEIGHT ?? 12), 1), 40);
const AI_DJ_DIVERSITY_ARTIST_STREAK = Math.max(Number(process.env.AI_DJ_DIVERSITY_ARTIST_STREAK ?? 4), 1);
const AI_DJ_DIVERSITY_ALBUM_STREAK = Math.max(Number(process.env.AI_DJ_DIVERSITY_ALBUM_STREAK ?? 3), 1);
const AI_DJ_DIVERSITY_FIT_BAND = Math.min(Math.max(Number(process.env.AI_DJ_DIVERSITY_FIT_BAND ?? 4), 0), 25);
const AI_DJ_DIVERSITY_QUALITY_BAND = Math.min(Math.max(Number(process.env.AI_DJ_DIVERSITY_QUALITY_BAND ?? 5), 0), 40);

function sourceSet(candidate) {
  return new Set([candidate?.source, ...(candidate?.providerSources || [])].filter(Boolean));
}

function artistKey(value) {
  return normalizeComparableText(cleanArtistName(value || ""));
}

function albumKey(track) {
  const metadata = getTrackMetadata(track);
  const id = metadata.albumId || track?.userData?.albumId;
  if (id) return `id:${id}`;
  const title = metadata.albumTitle || track?.userData?.albumTitle || track?.info?.albumName;
  const artist = artistKey(track?.userData?.autoplayReference?.artist || track?.info?.author);
  return title ? `text:${artist}|${normalizeComparableText(title)}` : null;
}

function candidateAlbumKey(candidate) {
  if (candidate?.albumId) return `id:${candidate.albumId}`;
  if (!candidate?.albumTitle) return null;
  return `text:${artistKey(candidate.artist)}|${normalizeComparableText(candidate.albumTitle)}`;
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
  return getExposureKey(candidate) || `${artistKey(candidate?.artist)}|${normalizeComparableText(candidate?.title)}`;
}

function hasStrongContinuation(candidate, context) {
  const candidateArtist = artistKey(candidate.artist);
  const candidateAlbum = candidateAlbumKey(candidate);
  const sameArtist = candidateArtist && candidateArtist === context.referenceArtist;
  const sameAlbum = candidateAlbum && candidateAlbum === context.referenceAlbum;
  if (!sameArtist && !sameAlbum) return false;

  const candidateFamilies = getGenreFamilies(candidate.genres || []);
  const genreCompatible = !context.referenceFamilies.length
    || !candidateFamilies.length
    || areGenreFamiliesCompatible(context.referenceFamilies, candidateFamilies);
  if (!genreCompatible) return false;

  const sources = sourceSet(candidate);
  return (sameAlbum && sources.has("same_album"))
    || (sameArtist && sources.has("lastfm_similar") && Number(candidate.similarity) >= 0.7);
}

function scoreCandidateV3(candidate, context) {
  const sources = sourceSet(candidate);
  const candidateGenres = getGenreFamilies(candidate.genres || []);
  const candidateArtist = artistKey(candidate.artist);
  const candidateAlbum = candidateAlbumKey(candidate);
  const sameArtist = candidateArtist && candidateArtist === context.referenceArtist;
  const sameAlbum = candidateAlbum && candidateAlbum === context.referenceAlbum;
  const relation = sources.has("lastfm_similar")
    ? 40 + Math.round((Number(candidate.similarity) || 0) * 10)
    : sources.has("same_album")
      ? 44
      : sources.has("ai_dj")
        ? 62 - Math.min(18, Math.max(0, Number(candidate.aiDjRank) || 0) * 2)
      : sources.has("youtube_mix")
        ? 30
        : 0;

  const anchorMatch = context.anchorFamilies.length && candidateGenres.length
    ? candidateGenres.filter((genre) => context.anchorFamilies.includes(genre)).length / candidateGenres.length
    : 0;
  const referenceMatch = context.referenceFamilies.length && candidateGenres.length
    ? candidateGenres.filter((genre) => context.referenceFamilies.includes(genre)).length / candidateGenres.length
    : 0;
  const genreScore = Math.round(Math.min(1, anchorMatch * 0.7 + referenceMatch * 0.3) * 30);
  const continuationDepth = sameAlbum ? Math.max(context.albumStreak, context.artistStreak) : context.artistStreak;
  const softCap = sameAlbum ? MAX_CONSECUTIVE_ALBUM_TRACKS : MAX_CONSECUTIVE_ARTIST_TRACKS;
  const continuationScore = sameAlbum ? 12 : sameArtist ? 8 : 0;
  const continuationPenalty = Math.max(0, continuationDepth - softCap + 1) * (sameAlbum ? 3 : 4);
  const diversityScore = sameArtist ? 0 : 6;
  // A soft exit never rejects a natural continuation: it only lets a similarly
  // credible bridge outrank it after the room has stayed in one lane for a bit.
  const softArtistExitStreak = Math.max(Number(context.softArtistExitStreak ?? SOFT_ARTIST_EXIT_STREAK), 1);
  const softAlbumExitStreak = Math.max(Number(context.softAlbumExitStreak ?? SOFT_ALBUM_EXIT_STREAK), 1);
  const softArtistExitPenalty = Math.max(Number(context.softArtistExitPenalty ?? SOFT_ARTIST_EXIT_PENALTY), 0);
  const softAlbumExitPenalty = Math.max(Number(context.softAlbumExitPenalty ?? SOFT_ALBUM_EXIT_PENALTY), 0);
  const artistExitSteps = sameArtist ? Math.max(0, context.artistStreak - softArtistExitStreak + 1) : 0;
  const albumExitSteps = sameAlbum ? Math.max(0, context.albumStreak - softAlbumExitStreak + 1) : 0;
  const softExitPenalty = artistExitSteps * softArtistExitPenalty + albumExitSteps * softAlbumExitPenalty;
  const aiDjFit = Number.isFinite(Number(candidate.aiDjFit)) ? Number(candidate.aiDjFit) : null;

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
      aiDjFit,
      sameArtist,
      sameAlbum,
    },
  };
}

function getAIDirectorPriority(entry) {
  const fit = Number.isFinite(Number(entry?.candidate?.aiDjFit)) ? Number(entry.candidate.aiDjFit) : 0;
  const rank = Math.max(0, Number(entry?.candidate?.aiDjRank) || 0);
  // Fit is supplied by the director and is deliberately weighted enough that
  // generic provider metadata cannot overturn a clear AI ordering.
  // Keep even a small model fit difference above noisy catalog-score swings.
  // V3 still breaks truly equal AI fits, and validates every hard safety rule.
  return fit * AI_DJ_PRIORITY_WEIGHT * 10 + entry.score - rank / 100;
}

function canSoftlyDeferAIDirectorChoice(primary, alternative, context) {
  if (!primary || !alternative) return false;
  const primaryFit = Number(primary.candidate.aiDjFit);
  const alternativeFit = Number(alternative.candidate.aiDjFit);
  if (!Number.isFinite(primaryFit) || !Number.isFinite(alternativeFit)) return false;
  if (alternativeFit < primaryFit - AI_DJ_DIVERSITY_FIT_BAND) return false;
  if (alternative.score < primary.score - AI_DJ_DIVERSITY_QUALITY_BAND) return false;

  const artistExitWanted = primary.details.sameArtist && context.artistStreak >= AI_DJ_DIVERSITY_ARTIST_STREAK;
  const albumExitWanted = primary.details.sameAlbum && context.albumStreak >= AI_DJ_DIVERSITY_ALBUM_STREAK;
  if (!artistExitWanted && !albumExitWanted) return false;

  return (artistExitWanted && !alternative.details.sameArtist)
    || (albumExitWanted && !alternative.details.sameAlbum);
}

function orderAIDirectorCandidates(ranked, context) {
  const ordered = [...ranked].sort((left, right) => {
    const priorityDelta = getAIDirectorPriority(right) - getAIDirectorPriority(left);
    if (priorityDelta) return priorityDelta;
    return (Number(left.candidate.aiDjRank) || 0) - (Number(right.candidate.aiDjRank) || 0);
  });
  const primary = ordered[0];
  const alternativeIndex = ordered.findIndex((entry, index) => index > 0 && canSoftlyDeferAIDirectorChoice(primary, entry, context));
  if (alternativeIndex === -1) return { ranked: ordered, deferred: null };

  const [alternative] = ordered.splice(alternativeIndex, 1);
  ordered.unshift(alternative);
  return {
    ranked: ordered,
    deferred: {
      artist: primary.candidate.artist,
      title: primary.candidate.title,
      fit: primary.candidate.aiDjFit,
      forArtist: alternative.candidate.artist,
      forTitle: alternative.candidate.title,
      forFit: alternative.candidate.aiDjFit,
    },
  };
}

function selectV3Candidates(candidates, context) {
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
    if (!sources.has("lastfm_similar") && !sources.has("youtube_mix") && !sources.has("same_album") && !sources.has("ai_dj")) {
      bump("unrelated-source");
      continue;
    }
    if (hasRecentExposure(candidate, context.profile, context.exposure, context.referenceTrack)) {
      bump("recent-duplicate");
      continue;
    }

    const candidateArtist = artistKey(candidate.artist);
    const candidateAlbum = candidateAlbumKey(candidate);
    if (candidateArtist && context.skippedArtists.has(candidateArtist)) {
      bump("skipped-artist");
      continue;
    }
    const candidateFamilies = getGenreFamilies(candidate.genres || []);
    if (context.anchorFamilies.length && candidateFamilies.length && !areGenreFamiliesCompatible(context.anchorFamilies, candidateFamilies)) {
      bump("anchor-genre-drift");
      continue;
    }
    if (context.referenceFamilies.length && candidateFamilies.length && !areGenreFamiliesCompatible(context.referenceFamilies, candidateFamilies)) {
      bump("transition-genre-drift");
      continue;
    }
    const strongContinuation = hasStrongContinuation(candidate, context);
    const aiDirected = sources.has("ai_dj");
    if (candidateArtist && candidateArtist === context.referenceArtist && context.artistStreak >= MAX_CONSECUTIVE_ARTIST_TRACKS) {
      if (aiDirected && context.artistStreak >= AI_DJ_MAX_CONSECUTIVE_ARTIST_TRACKS) {
        bump("ai-artist-streak");
        continue;
      }
      if (!aiDirected && !strongContinuation) {
        bump("artist-streak");
        continue;
      }
      if (!aiDirected && context.artistStreak >= MAX_ARTIST_CONTINUITY_STREAK) {
        bump("artist-continuity-limit");
        continue;
      }
    }
    if (candidateAlbum && candidateAlbum === context.referenceAlbum && context.albumStreak >= MAX_CONSECUTIVE_ALBUM_TRACKS) {
      if (aiDirected && context.albumStreak >= AI_DJ_MAX_CONSECUTIVE_ALBUM_TRACKS) {
        bump("ai-album-streak");
        continue;
      }
      if (!aiDirected && !strongContinuation) {
        bump("album-streak");
        continue;
      }
      if (!aiDirected && context.albumStreak >= MAX_ALBUM_CONTINUITY_STREAK) {
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
    aiDjVerifiedCatalog: Boolean(verified),
    aiDJ: {
      model: aiResult.model || null,
      confidence: aiResult.plan.confidence,
      direction: aiResult.plan.direction,
      reasons: aiResult.plan.reasons,
      proposalReason: proposal.reason,
      cached: Boolean(aiResult.cached),
    },
  };
  });
}

async function resolveV3Candidates(ranked, guildId, referenceTrack, anchorTrack, context) {
  for (const entry of ranked) {
    const aiDirected = sourceSet(entry.candidate).has("ai_dj");
    const track = await resolveToPlayable(entry.candidate, guildId, {
      referenceTitle: referenceTrack.info?.title || "",
      providerSources: aiDirected && !entry.candidate.track ? ["youtube", "deezer", "soundcloud", "spotify"] : null,
      debugLabel: aiDirected ? `ai-dj:${entry.candidate.artist} - ${entry.candidate.title}` : "v3-candidate",
    });
    if (!track) continue;
    applyCandidateMetadata(track, entry.candidate);
    if (hasRecentExposure(track, context.profile, context.exposure, context.referenceTrack)) {
      Log.info("Autoplay resolved track rejected as a cross-provider repeat", "", `guild=${guildId}`, `track=${track.info?.author || "Unknown"} - ${track.info?.title || "Unknown"}`);
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

async function fetchAutoplayV3Track(referenceTrack, guildId, { pendingManualTracks = [] } = {}) {
  if (!referenceTrack?.info) return null;
  if (!getGuildState(guildId)?.autoplay) return null;

  const anchorTrack = await enrichAnchorGenres(getAnchorTrack(guildId, referenceTrack));
  const profile = buildSessionProfile(guildId, referenceTrack, { pendingManualTracks });
  profile.autoplayExposure = await getAutoplayExposureSnapshot(guildId);

  const recentTracks = getRecentTracks(profile, referenceTrack);
  const referenceMetadata = getTrackMetadata(referenceTrack);
  const anchorMetadata = getTrackMetadata(anchorTrack);
  const referenceArtist = artistKey(referenceTrack.userData?.autoplayReference?.artist || referenceTrack.info?.author);
  const referenceAlbum = albumKey(referenceTrack);
  const skipPatterns = getSkipPatterns(guildId);
  const skippedArtists = new Set(Object.keys(skipPatterns.skippedArtists || {}).map(artistKey));
  const context = {
    profile,
    exposure: profile.autoplayExposure,
    referenceArtist,
    referenceAlbum,
    referenceFamilies: getGenreFamilies(referenceMetadata.genres),
    anchorFamilies: getGenreFamilies(anchorMetadata.genres),
    artistStreak: consecutiveCount(recentTracks, (track) => artistKey(track.userData?.autoplayReference?.artist || track.info?.author) === referenceArtist),
    albumStreak: referenceAlbum ? consecutiveCount(recentTracks, (track) => albumKey(track) === referenceAlbum) : 0,
    skippedArtists,
    referenceTrack,
    repeatCooldownMs: REPEAT_COOLDOWN_MS,
    softArtistExitStreak: SOFT_ARTIST_EXIT_STREAK,
    softAlbumExitStreak: SOFT_ALBUM_EXIT_STREAK,
    softArtistExitPenalty: SOFT_ARTIST_EXIT_PENALTY,
    softAlbumExitPenalty: SOFT_ALBUM_EXIT_PENALTY,
  };

  const reference = getAutoplayReference(referenceTrack);
  const candidates = await collectCandidates(referenceTrack, guildId, profile, reference, {
    sources: ["sameAlbum", "lastfm", "youtubeMix"],
  });
  profile.verifiedCatalogCandidates = candidates;
  const aiResult = await planNextTrackWithAIDJ({ guildId, anchorTrack, referenceTrack, profile, context });

  const aiCandidates = buildAIDJCandidates(aiResult, candidates);
  const { ranked: aiEligible, rejected: aiRejected } = selectV3Candidates(aiCandidates, context);
  const { ranked: aiRanked, deferred: aiDeferred } = orderAIDirectorCandidates(aiEligible, context);
  const aiResolved = await resolveV3Candidates(aiRanked, guildId, referenceTrack, anchorTrack, context);
  const { ranked, rejected } = selectV3Candidates(candidates, context);
  const resolved = aiResolved || await resolveV3Candidates(ranked, guildId, referenceTrack, anchorTrack, context);

  Log.info(
    "Autoplay V3 selection",
    "",
    `guild=${guildId}`,
    `anchor=${anchorTrack.info?.author || "Unknown"} - ${anchorTrack.info?.title || "Unknown"}`,
    `reference=${referenceTrack.info?.author || "Unknown"} - ${referenceTrack.info?.title || "Unknown"}`,
    `candidates=${candidates.length}`,
    `eligible=${ranked.length}`,
    `verifiedCatalog=${candidates.length}`,
    `aiCandidates=${aiCandidates.length}`,
    `aiEligible=${aiRanked.length}`,
    `artistStreak=${context.artistStreak}`,
    `albumStreak=${context.albumStreak}`,
    `rejected=${Object.entries({ ...rejected, ...Object.fromEntries(Object.entries(aiRejected).map(([key, value]) => [`ai-${key}`, value])) }).map(([key, value]) => `${key}:${value}`).join(",") || "none"}`,
    `aiDj=${aiResult.status}${aiResult.plan ? `:${aiResult.plan.confidence}/${aiResult.plan.direction.summary}` : ""}`,
    `aiProposals=${aiCandidates.slice(0, 4).map((candidate) => `${candidate.artist} - ${candidate.title} [${candidate.aiDjFit}]`).join(" | ") || "none"}`,
    `aiOrder=${aiRanked.slice(0, 4).map((entry) => `${entry.candidate.artist} - ${entry.candidate.title} [fit=${entry.candidate.aiDjFit};priority=${Math.round(getAIDirectorPriority(entry))}]`).join(" | ") || "none"}`,
    `aiDeferred=${aiDeferred ? `${aiDeferred.artist} - ${aiDeferred.title} [${aiDeferred.fit}]=>${aiDeferred.forArtist} - ${aiDeferred.forTitle} [${aiDeferred.forFit}]` : "none"}`,
    `winner=${resolved ? `${resolved.track.info?.author} - ${resolved.track.info?.title} (${resolved.entry.score})${aiResolved ? ";ai-director" : ";fallback-v3"}` : "none"}`
  );

  return resolved?.track || null;
}

module.exports = {
  MAX_ALBUM_CONTINUITY_STREAK,
  MAX_CONSECUTIVE_ALBUM_TRACKS,
  MAX_CONSECUTIVE_ARTIST_TRACKS,
  MAX_ARTIST_CONTINUITY_STREAK,
  AI_DJ_MAX_CONSECUTIVE_ARTIST_TRACKS,
  AI_DJ_MAX_CONSECUTIVE_ALBUM_TRACKS,
  SOFT_ARTIST_EXIT_STREAK,
  SOFT_ALBUM_EXIT_STREAK,
  SOFT_ARTIST_EXIT_PENALTY,
  SOFT_ALBUM_EXIT_PENALTY,
  AI_DJ_PRIORITY_WEIGHT,
  AI_DJ_DIVERSITY_ARTIST_STREAK,
  AI_DJ_DIVERSITY_ALBUM_STREAK,
  AI_DJ_DIVERSITY_FIT_BAND,
  AI_DJ_DIVERSITY_QUALITY_BAND,
  REPEAT_COOLDOWN_MS,
  buildAIDJCandidates,
  fetchAutoplayV3Track,
  getRecentTracks,
  selectV3Candidates,
  scoreCandidateV3,
  getAIDirectorPriority,
  orderAIDirectorCandidates,
  hasRecentExposure,
};
