const { getGuildState } = require("../guildState");
const Log = require("../logs/log");
const { getPoru } = require("./players");
const { searchSpotifyTrack, getSpotifyRecommendations } = require("./spotifyRecommendations");
const { playbackState } = require("./state");
const { filterValidSongs } = require("./trackValidation");

const skipHistory = new Map();

function buildSessionProfile(guildId, referenceTrack) {
  const state = playbackState.get(guildId);
  const history = state?.history || [];

  const recentTracks = [...history.slice(-14), referenceTrack].filter(Boolean);

  if (recentTracks.length === 0) {
    return {
      topArtists: [],
      artistCounts: {},
      avgDuration: 0,
      totalTracks: 0,
      recentIdentifiers: [],
    };
  }

  const artistCounts = {};
  let totalDuration = 0;
  const identifiers = [];

  recentTracks.forEach((track) => {
    const artist = track.info?.author || "Unknown";
    const duration = track.info?.length || 0;
    const id = track.info?.identifier;

    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    totalDuration += duration;
    if (id) identifiers.push(id);
  });

  const topArtists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count, weight: count / recentTracks.length }));

  const avgDuration = totalDuration / recentTracks.length;

  return {
    topArtists,
    artistCounts,
    avgDuration,
    totalTracks: recentTracks.length,
    recentIdentifiers: identifiers.slice(-20),
  };
}

function getSkipPatterns(guildId) {
  const skips = skipHistory.get(guildId) || [];
  const recentSkips = skips.filter((s) => Date.now() - s.timestamp < 30 * 60 * 1000);

  const skippedArtists = {};
  recentSkips.forEach((skip) => {
    if (skip.artist) {
      skippedArtists[skip.artist] = (skippedArtists[skip.artist] || 0) + 1;
    }
  });

  return {
    recentSkips,
    skippedArtists,
    totalSkips: recentSkips.length,
  };
}

function recordSkip(guildId, track, reason = "manual") {
  if (!skipHistory.has(guildId)) {
    skipHistory.set(guildId, []);
  }

  const skips = skipHistory.get(guildId);
  skips.push({
    artist: track.info?.author,
    title: track.info?.title,
    timestamp: Date.now(),
    reason,
  });

  if (skips.length > 50) {
    skips.splice(0, skips.length - 50);
  }

  Log.info("Skip recorded for learning", "", `guild=${guildId}`, `artist=${track.info?.author}`, `reason=${reason}`);
}

async function collectCandidates(referenceTrack, guildId, profile) {
  const poru = getPoru();
  const candidates = [];
  const { title, author, identifier } = referenceTrack.info;

  try {
    const trackId = await searchSpotifyTrack(title, author);
    if (trackId) {
      const spotifyRecs = await getSpotifyRecommendations(trackId, 10);

      for (const rec of spotifyRecs) {
        candidates.push({
          artist: rec.artist,
          title: rec.title,
          source: "spotify",
          score: 0,
        });
      }

      Log.info("Collected Spotify candidates", "", `guild=${guildId}`, `count=${spotifyRecs.length}`);
    }
  } catch (err) {
    Log.warning("Failed to get Spotify recommendations", err.message);
  }

  try {
    const radioQuery = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
    const radioRes = await poru.resolve({ query: radioQuery });

    if (radioRes?.tracks?.length > 1) {
      const validTracks = filterValidSongs(radioRes.tracks.slice(1, 21));

      validTracks.forEach((track) => {
        candidates.push({
          artist: track.info?.author,
          title: track.info?.title,
          identifier: track.info?.identifier,
          duration: track.info?.length,
          source: "youtube_mix",
          track: track,
          score: 0,
        });
      });

      Log.info("Collected YouTube Mix candidates", "", `guild=${guildId}`, `count=${validTracks.length}`);
    }
  } catch (err) {
    Log.warning("Failed to get YouTube Mix", err.message);
  }

  if (profile.topArtists.length > 0) {
    const topArtist = profile.topArtists[0].artist;

    try {
      const searchRes = await poru.resolve({ query: `ytsearch:${topArtist}` });
      const validTracks = filterValidSongs(searchRes.tracks || []).slice(0, 10);

      validTracks.forEach((track) => {
        candidates.push({
          artist: track.info?.author,
          title: track.info?.title,
          identifier: track.info?.identifier,
          duration: track.info?.length,
          source: "top_artist_search",
          track: track,
          score: 0,
        });
      });

      Log.info(
        "Collected top artist candidates",
        "",
        `guild=${guildId}`,
        `artist=${topArtist}`,
        `count=${validTracks.length}`
      );
    } catch (err) {
      Log.warning("Failed to search top artist", err.message);
    }
  }

  return candidates;
}

function scoreCandidates(candidates, profile, skipPatterns) {
  candidates.forEach((candidate) => {
    let score = 50;

    const artistWeight = profile.artistCounts[candidate.artist] || 0;
    score += artistWeight * 5;

    if (candidate.duration && profile.avgDuration) {
      const durationDiff = Math.abs(candidate.duration - profile.avgDuration);
      const durationRatio = durationDiff / profile.avgDuration;

      if (durationRatio < 0.2) score += 10;
      else if (durationRatio < 0.4) score += 5;
      else score -= 5;
    }

    if (candidate.source === "spotify") score += 25;
    else if (candidate.source === "youtube_mix") score += 15;
    else if (candidate.source === "top_artist_search") score += 10;

    const isRecentArtist = profile.topArtists.slice(0, 3).some((a) => a.artist === candidate.artist);
    if (!isRecentArtist) {
      score += 20;
    } else {
      score -= 10;
    }

    const skipCount = skipPatterns.skippedArtists[candidate.artist] || 0;
    score -= skipCount * 20;

    if (profile.recentIdentifiers.includes(candidate.identifier)) {
      score -= 1000;
    }

    candidate.score = Math.max(0, score);
  });

  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

async function resolveToPlayable(candidate, guildId) {
  if (candidate.track) {
    return candidate.track;
  }

  const poru = getPoru();
  const searchQuery = `${candidate.artist} ${candidate.title}`;

  try {
    const searchRes = await poru.resolve({ query: `ytsearch:${searchQuery}` });
    const validTracks = filterValidSongs(searchRes.tracks || []);

    if (validTracks.length > 0) {
      Log.info("Resolved candidate to playable track", "", `guild=${guildId}`, `query=${searchQuery}`);
      return validTracks[0];
    }
  } catch (err) {
    Log.error("Failed to resolve candidate", err, `guild=${guildId}`, `query=${searchQuery}`);
  }

  return null;
}

async function fetchSmartAutoplayTrack(referenceTrack, guildId) {
  if (!referenceTrack?.info) return null;

  const guildSettings = getGuildState(guildId);
  if (!guildSettings?.autoplay) return null;

  Log.info("Starting smart autoplay", "", `guild=${guildId}`, `reference=${referenceTrack.info.title}`);

  const profile = buildSessionProfile(guildId, referenceTrack);
  profile.guildId = guildId;

  Log.info(
    "Session profile built",
    "",
    `guild=${guildId}`,
    `tracks=${profile.totalTracks}`,
    `topArtist=${profile.topArtists[0]?.artist}`,
    `top3Artists=${profile.topArtists
      .slice(0, 3)
      .map((a) => a.artist)
      .join(", ")}`,
    `avgDuration=${Math.floor(profile.avgDuration / 1000)}s`
  );

  const skipPatterns = getSkipPatterns(guildId);

  const candidates = await collectCandidates(referenceTrack, guildId, profile);

  if (candidates.length === 0) {
    Log.warning("No candidates found for smart autoplay", "", `guild=${guildId}`);
    return null;
  }

  Log.info("Candidates collected", "", `guild=${guildId}`, `total=${candidates.length}`);

  const rankedCandidates = scoreCandidates(candidates, profile, skipPatterns);

  Log.info(
    "Candidates scored",
    "",
    `guild=${guildId}`,
    `top3=${rankedCandidates
      .slice(0, 3)
      .map((c) => `${c.artist} - ${c.title} (${c.score})`)
      .join(", ")}`
  );

  for (let i = 0; i < Math.min(5, rankedCandidates.length); i++) {
    const candidate = rankedCandidates[i];

    if (candidate.score < 10) {
      Log.warning("Top candidate score too low, giving up", "", `guild=${guildId}`, `score=${candidate.score}`);
      break;
    }

    const playableTrack = await resolveToPlayable(candidate, guildId);

    if (playableTrack) {
      Log.info(
        "Smart autoplay track selected",
        "",
        `guild=${guildId}`,
        `track=${playableTrack.info?.title}`,
        `artist=${playableTrack.info?.author}`,
        `score=${candidate.score}`,
        `source=${candidate.source}`
      );

      return playableTrack;
    }
  }

  Log.warning("Failed to resolve any candidate to playable track", "", `guild=${guildId}`);
  return null;
}

module.exports = {
  fetchSmartAutoplayTrack,
  recordSkip,
  buildSessionProfile,
};
