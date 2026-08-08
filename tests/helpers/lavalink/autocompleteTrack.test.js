const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  buildTrackAutocompleteValue,
  getDirectTrackUri,
  getTrackSourceName,
} = require("../../../helpers/lavalink/autocompleteTrack");

describe("Autocomplete track values", () => {
  it("preserves a playable provider URL instead of rebuilding a search query", () => {
    const track = {
      info: {
        title: "Ciepłe Dranie",
        author: "Kuki",
        sourceName: "soundcloud",
        uri: "https://soundcloud.com/kuki/cieple-dranie",
      },
    };

    assert.strictEqual(getTrackSourceName(track), "soundcloud");
    assert.strictEqual(getDirectTrackUri(track), track.info.uri);
    assert.strictEqual(buildTrackAutocompleteValue(track), track.info.uri);
  });

  it("pins a provider when Lavalink does not expose a short direct URL", () => {
    const track = {
      info: {
        title: "Ciepłe Dranie",
        author: "Kuki",
        sourceName: "soundcloud",
        uri: `https://soundcloud.com/${"x".repeat(120)}`,
      },
    };

    assert.strictEqual(buildTrackAutocompleteValue(track), "scsearch:Kuki Ciepłe Dranie");
  });
});
