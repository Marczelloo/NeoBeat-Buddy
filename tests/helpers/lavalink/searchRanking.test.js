const assert = require("node:assert");
const { describe, it } = require("node:test");

const { getPopularity, rankSearchResults, scoreSearchResult } = require("../../../helpers/lavalink/searchRanking");

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
});
