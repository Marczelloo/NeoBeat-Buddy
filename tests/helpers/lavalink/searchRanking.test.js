const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  filterRelevantSearchResults,
  getPopularity,
  rankSearchResults,
  scoreSearchResult,
} = require("../../../helpers/lavalink/searchRanking");

function createTrack(title, author, popularity = 0) {
  return {
    info: { title, author },
    pluginInfo: { popularity },
  };
}

function createViewRankedTrack(title, author, views) {
  return { info: { title, author, viewCount: views } };
}

describe("Search result ranking", () => {
  it("prefers an exact artist/title match over a more popular wrong song", () => {
    const tracks = [
      createTrack("Get Lucky", "Daft Punk", 98),
      createTrack("One More Time", "Daft Punk", 55),
      createTrack("One More Time (Official Video)", "Daft Punk", 80),
    ];

    const ranked = rankSearchResults(tracks, "Daft Punk - One More Time");

    assert.strictEqual(ranked[0].info.title, "One More Time");
    assert.notStrictEqual(ranked[0].info.title, "Get Lucky");
  });

  it("matches artist and title tokens when the query has no separator", () => {
    const tracks = [
      createTrack("Starboy", "The Weeknd", 99),
      createTrack("Blinding Lights", "The Weeknd", 75),
      createTrack("Blinding Lights (Live)", "The Weeknd", 90),
    ];

    const ranked = rankSearchResults(tracks, "The Weeknd Blinding Lights");

    assert.strictEqual(ranked[0].info.title, "Blinding Lights");
  });

  it("uses popularity as a tie-breaker for equally matching results", () => {
    const tracks = [
      createTrack("Ocean Eyes", "Billie Eilish", 20),
      createTrack("Ocean Eyes", "Billie Eilish", 90),
    ];

    const ranked = rankSearchResults(tracks, "Billie Eilish - Ocean Eyes");

    assert.strictEqual(getPopularity(ranked[0]), 90);
  });

  it("keeps provider order stable when candidates have the same score", () => {
    const tracks = [createTrack("Unknown", "Artist"), createTrack("Unknown", "Artist")];
    const ranked = rankSearchResults(tracks, "Artist - Unknown", { withScores: true });

    assert.strictEqual(ranked[0].index, 0);
    assert.ok(scoreSearchResult(tracks[0], "Artist - Unknown").score > 0);
  });

  it("normalizes curly apostrophes and uses view count for title ties", () => {
    const tracks = [
      createViewRankedTrack("Hit Em Up", "мэйби бэйби", 12000),
      createViewRankedTrack("Hit 'Em Up", "2Pac", 250000000),
    ];

    const ranked = rankSearchResults(tracks, "hit em up");

    assert.strictEqual(ranked[0].info.author, "2Pac");
  });

  it("prefers a canonical official version over an exact-title cover", () => {
    const tracks = [
      createTrack("Hit 'Em Up", "Bedoes 2115"),
      createTrack("Hit 'Em Up (Single Version)", "2Pac"),
    ];

    const ranked = rankSearchResults(tracks, "hit em up");

    assert.strictEqual(ranked[0].info.author, "2Pac");
  });

  it("filters unrelated provider results from a multi-word query", () => {
    const tracks = [
      createTrack("Why does YouTube Search Suck So Much", "Paul Yu"),
      createTrack("Hit 'Em Up (Single Version)", "2Pac"),
      createTrack("Hit Em Up Tutorial", "Random Channel"),
    ];

    const filtered = filterRelevantSearchResults(tracks, "hit em up");

    assert.deepStrictEqual(filtered.map((track) => track.info.author), ["2Pac"]);
  });

  it("keeps one-word autocomplete queries relevant", () => {
    const tracks = [
      createTrack("Ciepłe Dranie", "Kuki"),
      createTrack("Unrelated Song", "Another Artist"),
    ];

    const filtered = filterRelevantSearchResults(tracks, "kuki");

    assert.deepStrictEqual(filtered.map((track) => track.info.author), ["Kuki"]);
  });

  it("prefers the original Kuki recording over a remix", () => {
    const tracks = [
      createTrack("Ciepłe Dranie", "Kuki"),
      createTrack("Ciepłe Dranie (feat. Kuki) (Remix)", "Stock Wudeczka"),
      createTrack("KUKI CIEPŁE DRANIE", "Ali Baba"),
    ];

    const ranked = rankSearchResults(tracks, "kuki cieple dranie");

    assert.strictEqual(ranked[0].info.author, "Kuki");
    assert.strictEqual(ranked[0].info.title, "Ciepłe Dranie");
  });

  it("prefers the official Tamagotchi recording over an anonymous exact-title upload", () => {
    const tracks = [
      createTrack("TAMAGOTCHI", "😂"),
      createTrack("Tamagotchi (Remix)", "Kenia Os"),
      createTrack("Tamagotchi", "TACONAFIDE"),
      createTrack("Tamagotchi", "TACONAFIDE"),
      createTrack("Tamagotchi", "TACONAFIDE"),
      createTrack("Tamagotchi", "TACONAFIDE"),
    ];
    tracks[2].info.sourceName = "deezer";
    tracks[3].info.sourceName = "spotify";
    tracks[4].info.sourceName = "youtube";
    tracks[5].info.sourceName = "soundcloud";

    const ranked = rankSearchResults(tracks, "tamagotchi");

    assert.strictEqual(ranked[0].info.author, "TACONAFIDE");
    assert.strictEqual(ranked[0].info.title, "Tamagotchi");
  });

  it("penalizes remix and slowed variants when the query asks only for the base title", () => {
    const ranked = rankSearchResults(
      [
        createTrack("Tamagotchi (Remix)", "TACONAFIDE"),
        createTrack("Tamagotchi (slowed)", "Tuzera"),
        createTrack("Tamagotchi", "TACONAFIDE"),
      ],
      "tamagotchi"
    );

    assert.strictEqual(ranked[0].info.title, "Tamagotchi");
    assert.strictEqual(ranked[0].info.author, "TACONAFIDE");
  });
});
