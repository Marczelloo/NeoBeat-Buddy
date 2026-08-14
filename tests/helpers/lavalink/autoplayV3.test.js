const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  MAX_ALBUM_CONTINUITY_STREAK,
  MAX_CONSECUTIVE_ALBUM_TRACKS,
  MAX_CONSECUTIVE_ARTIST_TRACKS,
  MAX_ARTIST_CONTINUITY_STREAK,
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
});
