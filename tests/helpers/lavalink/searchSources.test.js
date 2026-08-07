const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  beginAutocompleteRequest,
  isLatestAutocompleteRequest,
} = require("../../../helpers/interactions/autocompleteGuard");
const {
  getFallbackSource,
  getSearchPrefix,
  resolveSearchSource,
} = require("../../../helpers/lavalink/searchSources");

describe("Search source selection", () => {
  it("keeps an explicit source, including auto", () => {
    assert.strictEqual(resolveSearchSource("spotify", "deezer", "youtube"), "spotify");
    assert.strictEqual(resolveSearchSource("auto", "deezer", "youtube"), "auto");
  });

  it("falls back to user, guild, and then Deezer preferences", () => {
    assert.strictEqual(resolveSearchSource(null, "spotify", "youtube"), "spotify");
    assert.strictEqual(resolveSearchSource(null, null, "youtube"), "youtube");
    assert.strictEqual(resolveSearchSource(null, null, null), "deezer");
  });

  it("maps sources to the correct Lavalink prefix and fallback", () => {
    assert.strictEqual(getSearchPrefix("deezer"), "dzsearch");
    assert.strictEqual(getSearchPrefix("youtube"), "ytsearch");
    assert.strictEqual(getSearchPrefix("spotify"), "spsearch");
    assert.strictEqual(getFallbackSource("spotify"), "spotify");
    assert.strictEqual(getFallbackSource("auto"), "youtube");
  });

  it("marks older autocomplete requests as stale", () => {
    const first = beginAutocompleteRequest("user:guild");
    const second = beginAutocompleteRequest("user:guild");

    assert.strictEqual(isLatestAutocompleteRequest("user:guild", first), false);
    assert.strictEqual(isLatestAutocompleteRequest("user:guild", second), true);
  });
});
