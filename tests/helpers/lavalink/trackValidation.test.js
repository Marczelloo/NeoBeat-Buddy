const assert = require("node:assert");
const { describe, it } = require("node:test");

const { filterAutoplaySongs, isValidSong } = require("../../../helpers/lavalink/trackValidation");

describe("Autoplay track validation", () => {
  it("keeps manual album interludes valid while excluding them from autoplay", () => {
    const interlude = { title: "Neon Interlude", author: "Artist", length: 56_000, isStream: false };
    assert.strictEqual(isValidSong(interlude), true);
    assert.deepStrictEqual(filterAutoplaySongs([{ info: interlude }]), []);
  });

  it("does not reject a full-length song just because it is named Intro or Outro", () => {
    const fullSong = { title: "Intro", author: "Artist", length: 245_000, isStream: false };
    assert.strictEqual(filterAutoplaySongs([{ info: fullSong }]).length, 1);
  });

  it("filters skits and transitions from autoplay candidates", () => {
    const tracks = [
      { info: { title: "Call Me Back", author: "Artist", length: 190_000 } },
      { info: { title: "Phone Skit", author: "Artist", length: 80_000 } },
      { info: { title: "Transition", author: "Artist", length: 70_000 } },
    ];
    assert.deepStrictEqual(filterAutoplaySongs(tracks).map((track) => track.info.title), ["Call Me Back"]);
  });
});
