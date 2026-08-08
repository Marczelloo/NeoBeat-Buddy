const assert = require("node:assert");
const { beforeEach, describe, it } = require("node:test");

const { scoreCandidates } = require("../../../helpers/lavalink/candidateScoring");
const { buildSessionProfile } = require("../../../helpers/lavalink/sessionProfile");
const { playbackState } = require("../../../helpers/lavalink/state");

const GUILD_ID = "dj-v2-test";
const noSkips = { skippedArtists: {}, skippedGenres: {} };

function track(title, artist, identifier, options = {}) {
  return {
    track: `encoded-${identifier}`,
    info: { title, author: artist, identifier, length: options.duration || 180000, autoplayed: Boolean(options.autoplay) },
    userData: {
      autoplay: Boolean(options.autoplay),
      genres: options.genres || [],
      features: options.features || null,
    },
  };
}

function candidate(title, artist, identifier, options = {}) {
  return {
    title,
    artist,
    identifier,
    duration: 180000,
    source: options.source || "lastfm_similar",
    genres: options.genres || [],
    features: options.features || null,
    popularity: options.popularity || 0,
    similarity: options.similarity || 0,
    isFallback: Boolean(options.isFallback),
  };
}

function profile(overrides = {}) {
  return {
    totalTracks: 3,
    artistCounts: {},
    topArtists: [],
    topGenres: [],
    recentIdentifiers: [],
    cooldownTracks: [],
    recentTracks: [],
    recentAutoplayTracks: [],
    lastThreeArtists: [],
    avgDuration: 180000,
    avgTempo: null,
    avgFeatures: null,
    energyTrend: null,
    valenceTrend: null,
    referenceGenres: [],
    referenceGenreFamilies: [],
    referenceFeatures: null,
    recentGenreFamilies: [],
    ...overrides,
  };
}

describe("DJ autoplay v2", () => {
  beforeEach(() => playbackState.clear());

  it("treats Last.fm similarity as a positive signal, not catalog popularity", () => {
    const ranked = scoreCandidates(
      [
        candidate("Close match", "Similar Artist", "similar", { similarity: 0.95 }),
        candidate("Popular but weak", "Other Artist", "popular", { source: "deezer_recommendations", popularity: 80 }),
      ],
      profile(),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked[0].identifier, "similar");
    assert.ok(ranked[0].scoringDetails.some((detail) => detail.startsWith("similarity:+")));
    assert.ok(!ranked[0].scoringDetails.some((detail) => detail.includes("overplayed")));
  });

  it("rejects an unqualified fallback when the room already has a genre anchor", () => {
    const [ranked] = scoreCandidates(
      [candidate("Unknown fallback", "Unknown uploader", "unsafe", { source: "youtube_search", isFallback: true })],
      profile({ referenceGenres: ["hip hop"], referenceGenreFamilies: ["hiphop"] }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "fallback-without-vibe-signal");
  });

  it("hard-rejects a genre jump even when a fallback is popular", () => {
    const [ranked] = scoreCandidates(
      [candidate("Heavy detour", "Metal Artist", "metal", { source: "deezer_recommendations", genres: ["metalcore"], popularity: 80 })],
      profile({
        referenceGenres: ["trap"],
        referenceGenreFamilies: ["hiphop"],
        topGenres: [{ genre: "trap", count: 3, weight: 1 }],
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "incompatible-genre-family");
  });

  it("keeps a manual genre anchor when autoplay tracks start to drift", () => {
    const manual = track("Manual rap", "Listener", "manual", { genres: ["hip hop"] });
    const firstAuto = track("Auto metal 1", "Bot", "auto-1", { autoplay: true, genres: ["metal"] });
    const secondAuto = track("Auto metal 2", "Bot", "auto-2", { autoplay: true, genres: ["metal"] });
    playbackState.set(GUILD_ID, { history: [manual, firstAuto, secondAuto], autoplayHistory: [] });

    const session = buildSessionProfile(GUILD_ID, manual);
    assert.strictEqual(session.topGenres[0].genre, "hip hop");
  });

  it("blocks a provider variant of a track that appeared much earlier in the session", () => {
    const oldTrack = track("Hit Em Up", "2Pac", "youtube-old", { genres: ["hip hop"] });
    const filler = Array.from({ length: 55 }, (_, index) => track(`Song ${index}`, `Artist ${index}`, `id-${index}`));
    playbackState.set(GUILD_ID, { history: [oldTrack, ...filler], autoplayHistory: [] });

    const session = buildSessionProfile(GUILD_ID, track("Reference", "Another Artist", "reference"));
    const [ranked] = scoreCandidates(
      [candidate("Hit 'Em Up (Official Audio)", "2Pac - Topic", "soundcloud-new", { source: "lastfm_similar", similarity: 0.99 })],
      session,
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.ok(ranked.scoringDetails.includes("duplicate:-1000(title)"));
  });
});
