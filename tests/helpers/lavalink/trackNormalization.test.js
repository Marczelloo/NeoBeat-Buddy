const assert = require("node:assert");
const { describe, it } = require("node:test");

const { normalizeGenreTags } = require("../../../helpers/lavalink/genreUtils");
const {
  cleanTrackMetadata,
  getAutoplayVersionCompatibility,
  getBaseTitle,
  getVariantKinds,
  isUnrequestedAlternateVersion,
} = require("../../../helpers/lavalink/trackNormalization");

describe("Autoplay track normalization", () => {
  it("rejects alternate versions for a base-title query", () => {
    const query = "Chappell Roan Pink Pony Club";
    const variants = [
      "Pink Pony Club (Acoustic)",
      "Pink Pony Club - Live at Coachella",
      "Pink Pony Club [Demo]",
      "Pink Pony Club (Slowed + Reverb)",
      "Pink Pony Club (Chopped and Screwed)",
    ];

    assert.ok(variants.every((title) => isUnrequestedAlternateVersion(title, query)));
    assert.strictEqual(isUnrequestedAlternateVersion("Pink Pony Club", query), false);
  });

  it("permits only the explicitly requested version family", () => {
    assert.strictEqual(isUnrequestedAlternateVersion("Pink Pony Club (Acoustic)", "Pink Pony Club acoustic"), false);
    assert.strictEqual(isUnrequestedAlternateVersion("Pink Pony Club (Live)", "Pink Pony Club acoustic"), true);
    assert.strictEqual(isUnrequestedAlternateVersion("Song (Acoustic Remix)", "Song Remix"), true);
  });

  it("keeps tempo styles available to autoplay without opening unrelated alternates", () => {
    assert.strictEqual(getAutoplayVersionCompatibility("Song (Nightcore)").allowed, true);
    assert.strictEqual(getAutoplayVersionCompatibility("Song (Slowed + Reverb)").mode, "tempo-style");
    assert.strictEqual(getAutoplayVersionCompatibility("Song (Nightcore)", "Reference (Nightcore)").mode, "tempo-consistent");
    assert.strictEqual(getAutoplayVersionCompatibility("Song (Remix)").allowed, false);
    assert.strictEqual(getAutoplayVersionCompatibility("Song (Remix)", "Reference (Remix)").allowed, true);
  });

  it("keeps base identity stable across Unicode, provider noise, and variants", () => {
    assert.strictEqual(getBaseTitle("Ciepłe Dranie [Official Audio]"), "cieple dranie");
    assert.strictEqual(getBaseTitle("Ciepłe Dranie (Acoustic Version)"), "cieple dranie");
    assert.strictEqual(getBaseTitle("Song Acoustic"), "song");
    assert.deepStrictEqual(getVariantKinds("Song - Radio Edit"), ["edit"]);
  });

  it("uses the provider artist only when a title prefix is not an artist", () => {
    assert.deepStrictEqual(cleanTrackMetadata("The Weeknd - Save Your Tears (Official Video)", "TheWeekndVEVO"), {
      cleanTitle: "Save Your Tears",
      searchArtist: "The Weeknd",
    });
    assert.deepStrictEqual(cleanTrackMetadata("Pink Pony Club - Acoustic", "Chappell Roan"), {
      cleanTitle: "Pink Pony Club",
      searchArtist: "Chappell Roan",
    });
  });
});

describe("Autoplay genre normalization", () => {
  it("merges aliases and removes community-tag noise", () => {
    assert.deepStrictEqual(
      normalizeGenreTags(
        ["Hip-Hop", "hip hop", "R & B", "synth pop", "2020s", "favorite", "The Weeknd", "Save Your Tears"],
        { artist: "The Weeknd", title: "Save Your Tears" }
      ),
      ["hiphop", "rnb", "synthpop"]
    );
  });
});
