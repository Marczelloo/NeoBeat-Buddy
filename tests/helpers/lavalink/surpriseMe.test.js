const assert = require("node:assert/strict");
const { beforeEach, describe, test } = require("node:test");
const {
  buildSurpriseSeedPool,
  clearSurpriseMemory,
  rememberFreestyleCandidate,
  selectFreestyleCandidates,
  selectSurpriseSeed,
} = require("../../../helpers/lavalink/surpriseMe");

function track(title, author) {
  return { info: { title, author, identifier: `${author}-${title}`, sourceName: "deezer" } };
}

describe("Surprise me selector", () => {
  beforeEach(() => clearSurpriseMemory());

  test("combines room, personal, liked, and frequent-listening signals", () => {
    const pool = buildSurpriseSeedPool({
      currentTrack: track("Current", "Room Artist"),
      roomHistory: [track("Room Pick", "Room Artist")],
      userHistory: [{ track: { title: "Personal Pick", author: "User Artist" } }],
      likedTracks: [{ title: "Liked Pick", author: "Liked Artist" }],
      topTracks: [{ track: "User Artist - Personal Pick", count: 8 }],
    });

    assert.equal(pool.length, 4);
    const personal = pool.find((seed) => seed.key === "user artist - personal pick");
    assert.ok(personal.sources.includes("history"));
    assert.ok(personal.sources.includes("top"));
    assert.equal(personal.frequency, 9);
  });

  test("does not repeat an intent and avoids recently used seeds", () => {
    const input = {
      roomHistory: [track("One", "Artist A"), track("Two", "Artist B"), track("Three", "Artist C")],
    };
    const first = selectSurpriseSeed(input, { random: () => 0, memoryKey: "listener" });
    const second = selectSurpriseSeed(input, { random: () => 0, memoryKey: "listener" });

    assert.notEqual(first.intent.mode, second.intent.mode);
    assert.notEqual(first.seedKey, second.seedKey);
  });

  test("returns null when no taste signal exists", () => {
    assert.equal(selectSurpriseSeed({}, { memoryKey: "empty" }), null);
  });

  test("uses fresh, chart-biased choices for an empty-room freestyle without replaying the last pick", () => {
    const candidates = [
      { artist: "Chart One", title: "Top Signal", chartPosition: 1, popularity: 100 },
      { artist: "Chart Two", title: "Fresh Signal", chartPosition: 2, popularity: 96 },
      { artist: "Chart Three", title: "Third Signal", chartPosition: 3, popularity: 92 },
    ];
    const memoryKey = "freestyle";
    const first = selectFreestyleCandidates(candidates, { memoryKey, count: 1, random: () => 0 })[0];
    rememberFreestyleCandidate(first, memoryKey);
    const second = selectFreestyleCandidates(candidates, { memoryKey, count: 1, random: () => 0 })[0];

    assert.equal(first.title, "Top Signal");
    assert.notEqual(second.title, first.title);
  });
});
