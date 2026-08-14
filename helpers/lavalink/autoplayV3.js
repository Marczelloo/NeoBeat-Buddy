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
const { cleanArtistName, normalizeComparableText } = require("./trackNormalization");

const MAX_CONSECUTIVE_ALBUM_TRACKS = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ALBUM_STREAK ?? 2), 1);
const MAX_CONSECUTIVE_ARTIST_TRACKS = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ARTIST_STREAK ?? 3), 1);
const MAX_ALBUM_CONTINUITY_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ALBUM_CONTINUITY_STREAK ?? 6), MAX_CONSECUTIVE_ALBUM_TRACKS);
const MAX_ARTIST_CONTINUITY_STREAK = Math.max(Number(process.env.AUTOPLAY_V3_MAX_ARTIST_CONTINUITY_STREAK ?? 6), MAX_CONSECUTIVE_ARTIST_TRACKS);
const REPEAT_COOLDOWN_MS = Math.max(Number(process.env.AUTOPLAY_REPEAT_COOLDOWN_MS ?? 60 * 60 * 1000), 0);

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
  const tracks = [...(profile.recentTracks || []), referenceTrack].filter(Boolean);
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

  return {
    candidate,
    score: relation + genreScore + continuationScore + diversityScore - continuationPenalty,
    details: { relation, genreScore, continuationScore, continuationPenalty, diversityScore, sameArtist, sameAlbum },
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

function buildAIDJCandidates(aiResult) {
  if (aiResult?.status !== "planned" || !Array.isArray(aiResult.plan?.candidates)) return [];

  return aiResult.plan.candidates.map((proposal, index) => ({
    artist: proposal.artist,
    title: proposal.title,
    albumTitle: proposal.album || null,
    source: "ai_dj",
    providerSources: ["ai_dj"],
    genres: [],
    similarity: null,
    aiDjRank: index,
    aiDJ: {
      model: aiResult.model || null,
      confidence: aiResult.plan.confidence,
      direction: aiResult.plan.direction,
      reasons: aiResult.plan.reasons,
      proposalReason: proposal.reason,
      cached: Boolean(aiResult.cached),
    },
  }));
}

async function resolveV3Candidates(ranked, guildId, referenceTrack, anchorTrack) {
  for (const entry of ranked) {
    const track = await resolveToPlayable(entry.candidate, guildId, { referenceTitle: referenceTrack.info?.title || "" });
    if (!track) continue;
    applyCandidateMetadata(track, entry.candidate);
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
  };

  const reference = getAutoplayReference(referenceTrack);
  // The director and provider collection intentionally run concurrently. The AI has
  // agency to propose a lane from the session itself; providers only validate that
  // an exact, playable recording actually exists.
  const aiPlanPromise = planNextTrackWithAIDJ({
    guildId,
    anchorTrack,
    referenceTrack,
    profile,
    context,
  });
  const candidatesPromise = collectCandidates(referenceTrack, guildId, profile, reference, {
    sources: ["sameAlbum", "lastfm", "youtubeMix"],
  });
  const [aiResult, candidates] = await Promise.all([aiPlanPromise, candidatesPromise]);

  const aiCandidates = buildAIDJCandidates(aiResult);
  const { ranked: aiRanked, rejected: aiRejected } = selectV3Candidates(aiCandidates, context);
  const aiResolved = await resolveV3Candidates(aiRanked, guildId, referenceTrack, anchorTrack);
  const { ranked, rejected } = selectV3Candidates(candidates, context);
  const resolved = aiResolved || await resolveV3Candidates(ranked, guildId, referenceTrack, anchorTrack);

  Log.info(
    "Autoplay V3 selection",
    "",
    `guild=${guildId}`,
    `anchor=${anchorTrack.info?.author || "Unknown"} - ${anchorTrack.info?.title || "Unknown"}`,
    `reference=${referenceTrack.info?.author || "Unknown"} - ${referenceTrack.info?.title || "Unknown"}`,
    `candidates=${candidates.length}`,
    `eligible=${ranked.length}`,
    `aiCandidates=${aiCandidates.length}`,
    `aiEligible=${aiRanked.length}`,
    `artistStreak=${context.artistStreak}`,
    `albumStreak=${context.albumStreak}`,
    `rejected=${Object.entries({ ...rejected, ...Object.fromEntries(Object.entries(aiRejected).map(([key, value]) => [`ai-${key}`, value])) }).map(([key, value]) => `${key}:${value}`).join(",") || "none"}`,
    `aiDj=${aiResult.status}${aiResult.plan ? `:${aiResult.plan.confidence}/${aiResult.plan.direction.summary}` : ""}`,
    `aiProposals=${aiCandidates.slice(0, 4).map((candidate) => `${candidate.artist} - ${candidate.title}`).join(" | ") || "none"}`,
    `winner=${resolved ? `${resolved.track.info?.author} - ${resolved.track.info?.title} (${resolved.entry.score})${aiResolved ? ";ai-director" : ";fallback-v3"}` : "none"}`
  );

  return resolved?.track || null;
}

module.exports = {
  MAX_ALBUM_CONTINUITY_STREAK,
  MAX_CONSECUTIVE_ALBUM_TRACKS,
  MAX_CONSECUTIVE_ARTIST_TRACKS,
  MAX_ARTIST_CONTINUITY_STREAK,
  REPEAT_COOLDOWN_MS,
  buildAIDJCandidates,
  fetchAutoplayV3Track,
  selectV3Candidates,
  scoreCandidateV3,
  hasRecentExposure,
};
