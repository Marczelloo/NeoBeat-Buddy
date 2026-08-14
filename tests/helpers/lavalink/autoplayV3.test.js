const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  MAX_ALBUM_CONTINUITY_STREAK,
  MAX_CONSECUTIVE_ALBUM_TRACKS,
  MAX_CONSECUTIVE_ARTIST_TRACKS,
  MAX_ARTIST_CONTINUITY_STREAK,
  AI_DJ_MAX_CONSECUTIVE_ALBUM_TRACKS,
  AI_DJ_MAX_CONSECUTIVE_ARTIST_TRACKS,
  buildAIDJCandidates,
  getRecentTracks,
  hasRecentExposure,
  selectV3Candidates,
} = require("../../../helpers/lavalink/autoplayV3");

function candidate(title, artist, source, options = {}) {
  return {
    title,
    artist,
    identifier: options.identifier || `${artist}-${title}`,
    source,
    genres: options.genres || ["synthpop"],
    similarity: options.similarity || 0,
    albumId: options.albumId || null,
    albumTitle: options.albumTitle || null,
  };
}

function context(overrides = {}) {
  return {
    profile: { cooldownTracks: [] },
    exposure: { tracks: [] },
    referenceArtist: "taco hemingway",
    referenceAlbum: "id:frascati",
    referenceFamilies: ["hiphop"],
    anchorFamilies: ["hiphop"],
    artistStreak: 0,
    albumStreak: 0,
    skippedArtists: new Set(),
    ...overrides,
  };
}

describe("Autoplay V3 selection", () => {
  it("uses durable autoplay history when player history misses provider-shaped tracks", () => {
    const taco = (title, identifier) => ({
      info: { title, author: "Taco Hemingway", identifier },
      userData: { autoplay: true },
    });
    const seed = { info: { title: "Tamagotchi", author: "Taco Hemingway", identifier: "seed" } };
    const recent = getRecentTracks({
      recentTracks: [seed, taco("Następna stacja", "one")],
      recentAutoplayTracks: [taco("Następna stacja", "one"), taco("A mówiłem Ci", "two"), taco("Od zera", "three")],
    }, taco("Od zera", "three"));

    assert.deepStrictEqual(recent.map((track) => track.info.identifier), ["seed", "one", "two", "three"]);
  });

  it("allows a recording to return after the short-session repeat cooldown", () => {
    const now = Date.now();
    const candidate = { artist: "Taco Hemingway", title: "Nostalgia" };
    const track = {
      info: { identifier: "nostalgia", author: "Taco Hemingway", title: "Nostalgia" },
      userData: { autoplayPlayedAt: now - (61 * 60 * 1000) },
    };

    assert.strictEqual(hasRecentExposure(candidate, { cooldownTracks: [track] }, { tracks: [] }, null, now), false);
    track.userData.autoplayPlayedAt = now - 1000;
    assert.strictEqual(hasRecentExposure(candidate, { cooldownTracks: [track] }, { tracks: [] }, null, now), true);
  });

  it("prioritizes a compatible same-album neighbour over a broad Last.fm relation", () => {
    const { ranked } = selectV3Candidates(
      [
        candidate("Frascati Interlude", "Taco Hemingway", "same_album", {
          albumId: "frascati",
          genres: ["hip hop"],
        }),
        candidate("Related Track", "Quebonafide", "lastfm_similar", {
          similarity: 0.93,
          genres: ["hip hop"],
        }),
      ],
      context()
    );

    assert.strictEqual(ranked[0].candidate.title, "Frascati Interlude");
  });

  it("keeps a direct same-album continuation after the soft caps while the vibe is compatible", () => {
    const { ranked, rejected } = selectV3Candidates(
      [candidate("Another Album Cut", "Taco Hemingway", "same_album", { albumId: "frascati", genres: ["hip hop"] })],
      context({ albumStreak: MAX_CONSECUTIVE_ALBUM_TRACKS, artistStreak: MAX_CONSECUTIVE_ARTIST_TRACKS })
    );

    assert.strictEqual(ranked.length, 1);
    assert.deepStrictEqual(rejected, {});
  });

  it("allows a good artist continuation until the explicit artist cap", () => {
    const followUp = candidate("Second Wind", "Taco Hemingway", "lastfm_similar", {
      similarity: 0.82,
      genres: ["hip hop"],
    });
    const allowed = selectV3Candidates([followUp], context({ artistStreak: MAX_CONSECUTIVE_ARTIST_TRACKS - 1 }));
    const blocked = selectV3Candidates([candidate("Generic Follow-up", "Taco Hemingway", "youtube_mix", { genres: ["hip hop"] })], context({ artistStreak: MAX_CONSECUTIVE_ARTIST_TRACKS }));

    assert.strictEqual(allowed.ranked.length, 1);
    assert.strictEqual(blocked.ranked.length, 0);
    assert.strictEqual(blocked.rejected["artist-streak"], 1);
  });

  it("gives an AI-directed same-artist run a wider but bounded ceiling", () => {
    const aiCandidate = candidate("Fiji", "Taco Hemingway", "ai_dj", { genres: ["hip hop"] });
    const allowed = selectV3Candidates([aiCandidate], context({ artistStreak: AI_DJ_MAX_CONSECUTIVE_ARTIST_TRACKS - 1 }));
    const blocked = selectV3Candidates([aiCandidate], context({ artistStreak: AI_DJ_MAX_CONSECUTIVE_ARTIST_TRACKS }));

    assert.strictEqual(allowed.ranked.length, 1);
    assert.strictEqual(blocked.ranked.length, 0);
    assert.strictEqual(blocked.rejected["ai-artist-streak"], 1);
  });

  it("softly prefers an equally credible artist exit after two consecutive tracks", () => {
    const sameArtist = candidate("Still Here", "Taco Hemingway", "ai_dj", { genres: ["hip hop"] });
    const compatibleExit = candidate("Natural Bridge", "Quebonafide", "ai_dj", { genres: ["hip hop"] });
    compatibleExit.aiDjRank = 1;

    const { ranked } = selectV3Candidates([sameArtist, compatibleExit], context({ artistStreak: 2 }));

    assert.strictEqual(ranked[0].candidate.title, "Natural Bridge");
    assert.ok(ranked[1].details.softExitPenalty > 0);
  });

  it("softly prefers another album without rejecting a strong continuation", () => {
    const sameAlbum = candidate("Another Cut", "Taco Hemingway", "ai_dj", {
      albumId: "frascati",
      genres: ["hip hop"],
    });
    const compatibleExit = candidate("Scene Bridge", "Quebonafide", "ai_dj", { genres: ["hip hop"] });
    compatibleExit.aiDjRank = 1;

    const { ranked } = selectV3Candidates([sameAlbum, compatibleExit], context({ artistStreak: 2, albumStreak: 2 }));
    const continuationOnly = selectV3Candidates([sameAlbum], context({ artistStreak: 2, albumStreak: 2 }));

    assert.strictEqual(ranked[0].candidate.title, "Scene Bridge");
    assert.strictEqual(continuationOnly.ranked.length, 1);
  });

  it("makes an AI album run bridge outward after its bounded ceiling", () => {
    const aiCandidate = candidate("Wosk", "Taco Hemingway", "ai_dj", { albumId: "frascati", genres: ["hip hop"] });
    const { ranked, rejected } = selectV3Candidates([aiCandidate], context({
      artistStreak: AI_DJ_MAX_CONSECUTIVE_ALBUM_TRACKS,
      albumStreak: AI_DJ_MAX_CONSECUTIVE_ALBUM_TRACKS,
    }));

    assert.deepStrictEqual(ranked, []);
    assert.strictEqual(rejected["ai-album-streak"], 1);
  });

  it("retains an emergency continuity cap to prevent endless album or artist loops", () => {
    const { ranked, rejected } = selectV3Candidates(
      [candidate("One Track Too Far", "Taco Hemingway", "same_album", { albumId: "frascati", genres: ["hip hop"] })],
      context({ albumStreak: MAX_ALBUM_CONTINUITY_STREAK, artistStreak: MAX_ARTIST_CONTINUITY_STREAK })
    );

    assert.deepStrictEqual(ranked, []);
    assert.strictEqual(rejected["artist-continuity-limit"], 1);
  });

  it("rejects a genre jump even when the candidate comes from a trusted source", () => {
    const { ranked, rejected } = selectV3Candidates(
      [candidate("Dancehall Detour", "Other Artist", "lastfm_similar", { similarity: 0.98, genres: ["reggae", "dancehall"] })],
      context()
    );

    assert.deepStrictEqual(ranked, []);
    assert.strictEqual(rejected["anchor-genre-drift"], 1);
  });

  it("deduplicates the same recording returned by more than one provider", () => {
    const { ranked, rejected } = selectV3Candidates(
      [
        candidate("Mirror Song", "Same Artist", "lastfm_similar", { similarity: 0.7, identifier: "lastfm-id", genres: ["hip hop"] }),
        candidate("Mirror Song (Official Audio)", "Same Artist", "youtube_mix", { identifier: "youtube-id", genres: ["hip hop"] }),
      ],
      context()
    );

    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(rejected["duplicate-candidate"], 1);
  });

  it("keeps YouTube Mix as a constrained fallback when similar tracks are rejected", () => {
    const { ranked, rejected } = selectV3Candidates(
      [
        candidate("Skipped Artist Track", "Skipped Artist", "lastfm_similar", { similarity: 0.95, genres: ["hip hop"] }),
        candidate("Mix Continuation", "Fresh Artist", "youtube_mix", { genres: ["hip hop"] }),
      ],
      context({ skippedArtists: new Set(["skipped artist"]) })
    );

    assert.strictEqual(rejected["skipped-artist"], 1);
    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(ranked[0].candidate.title, "Mix Continuation");
  });

  it("puts an AI director's exact proposals ahead of generic provider fallback candidates", () => {
    const aiCandidates = buildAIDJCandidates({
      status: "planned",
      model: "gpt-5.6-terra",
      plan: {
        confidence: 0.91,
        direction: { summary: "Reflective Polish rap", energy: "mid", mood: "late-night" },
        reasons: ["Protect the manual lane."],
        candidates: [
          { artist: "Taco Hemingway", title: "Wosk", album: "Frascati", reason: "Direct album continuation." },
        ],
      },
    });
    const { ranked, rejected } = selectV3Candidates([
      ...aiCandidates,
      candidate("Broad Mix Result", "Unrelated Artist", "youtube_mix", { genres: ["hip hop"] }),
    ], context());

    assert.deepStrictEqual(rejected, {});
    assert.strictEqual(ranked[0].candidate.title, "Wosk");
    assert.strictEqual(ranked[0].candidate.source, "ai_dj");
  });

  it("uses a matching verified catalog track directly for an AI proposal", () => {
    const directTrack = { info: { title: "Wosk", author: "Taco Hemingway", identifier: "wosk-direct" }, userData: { albumTitle: "Frascati" } };
    const aiCandidates = buildAIDJCandidates({
      status: "planned", model: "gpt-5.6-luna",
      plan: { confidence: 0.9, direction: { summary: "Polish rap", energy: "mid", mood: "night" }, reasons: ["Fit"], candidates: [
        { artist: "Taco Hemingway", title: "Wosk", album: "Frascati", reason: "Verified continuation." },
      ] },
    }, [{ artist: "Taco Hemingway", title: "Wosk", albumTitle: "Frascati", source: "youtube_mix", track: directTrack }]);

    assert.strictEqual(aiCandidates[0].track, directTrack);
    assert.strictEqual(aiCandidates[0].aiDjVerifiedCatalog, true);
  });

  it("still rejects an AI proposal that was already played in the session", () => {
    const aiCandidates = buildAIDJCandidates({
      status: "planned",
      model: "gpt-5.6-terra",
      plan: {
        confidence: 0.91,
        direction: { summary: "Reflective Polish rap", energy: "mid", mood: "late-night" },
        reasons: ["Protect the manual lane."],
        candidates: [
          { artist: "Taco Hemingway", title: "Wosk", album: "Frascati", reason: "Direct album continuation." },
        ],
      },
    });
    const { ranked, rejected } = selectV3Candidates(aiCandidates, context({
      profile: { cooldownTracks: [{ info: { title: "Wosk", author: "Taco Hemingway" } }] },
    }));

    assert.deepStrictEqual(ranked, []);
    assert.strictEqual(rejected["recent-duplicate"], 1);
  });
});
