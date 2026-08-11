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

  it("recognizes The Weeknd provider metadata variants as the same recording", () => {
    const youtube = {
      info: {
        title: "The Weeknd - Save Your Tears (Official Music Video)",
        author: "TheWeekndVEVO",
        identifier: "youtube-save-your-tears",
      },
    };
    const deezer = {
      title: "Save Your Tears",
      artist: "The Weeknd",
      identifier: "deezer-save-your-tears",
    };

    assert.strictEqual(hasTrackIdentity([youtube], deezer, { includeIdentifier: false }), true);
  });

  it("prefers canonical autoplay metadata for cross-provider cooldown matching", () => {
    const noisyPlayback = {
      info: { title: "Around Me [ChoppedNotSlopped]", author: "Metro Boomin - Topic" },
      userData: { autoplayReference: { title: "Around Me", artist: "Metro Boomin" } },
    };
    const cleanProviderVariant = { title: "Around Me", artist: "Metro Boomin" };

    assert.strictEqual(hasTrackIdentity([noisyPlayback], cleanProviderVariant, { includeIdentifier: false }), true);
  });

  it("recognizes featured-artist metadata variants without merging unrelated covers", () => {
    const original = { info: { title: "Save Your Tears", author: "The Weeknd" } };
    const remixMetadata = { title: "Save Your Tears (Remix)", artist: "The Weeknd & Ariana Grande" };
    const unrelatedCover = { title: "Save Your Tears", artist: "Different Artist" };

    assert.strictEqual(hasTrackIdentity([original], remixMetadata, { includeIdentifier: false }), true);
    assert.strictEqual(hasTrackIdentity([original], unrelatedCover, { includeIdentifier: false }), false);
  });

  it("uses ISRC as a provider-independent identity when available", () => {
    const youtube = {
      info: { title: "Save Your Tears", author: "The Weeknd - Topic", identifier: "youtube-save", isrc: "USUG12001870" },
    };
    const deezer = { title: "Save Your Tears", artist: "The Weeknd", identifier: "deezer-save", isrc: "US-UG1-20-01870" };

    assert.strictEqual(getTrackIdentity(youtube).preferredKey, "isrc:USUG12001870");
    assert.strictEqual(hasTrackIdentity([youtube], deezer, { includeIdentifier: false }), true);
  });
});
