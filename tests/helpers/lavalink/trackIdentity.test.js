const assert = require("node:assert");
const { describe, it } = require("node:test");

const { getTrackIdentity, hasTrackIdentity } = require("../../../helpers/lavalink/trackIdentity");

describe("Autoplay track identity", () => {
  it("recognizes provider variants of the same recording", () => {
    const played = {
      info: { title: "Hit Em Up", author: "2Pac - Topic", identifier: "youtube-id" },
    };
    const candidate = {
      title: "Hit 'Em Up (Official Audio)",
      artist: "2Pac",
      identifier: "soundcloud-id",
    };

    assert.strictEqual(hasTrackIdentity([played], candidate, { includeIdentifier: false }), true);
  });

  it("keeps different songs by the same artist distinct", () => {
    const first = getTrackIdentity({ info: { title: "Hit Em Up", author: "2Pac" } });
    const second = getTrackIdentity({ info: { title: "Changes", author: "2Pac" } });

    assert.notStrictEqual(first.textKey, second.textKey);
  });
});
