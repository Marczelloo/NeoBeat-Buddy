const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  beginAutocompleteRequest,
  isLatestAutocompleteRequest,
} = require("../../../helpers/interactions/autocompleteGuard");
const { buildFallbackQueries } = require("../../../helpers/lavalink/fallbacks");
const { clearSearchCache, searchAcrossSources } = require("../../../helpers/lavalink/searchAggregator");
const {
  getFallbackSources,
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
    assert.strictEqual(getSearchPrefix("soundcloud"), "scsearch");
    assert.strictEqual(getFallbackSource("spotify"), "spotify");
    assert.strictEqual(getFallbackSource("auto"), "youtube");
    assert.deepStrictEqual(getFallbackSources("deezer"), ["soundcloud", "youtube", "spotify"]);
  });

  it("marks older autocomplete requests as stale", () => {
    const first = beginAutocompleteRequest("user:guild");
    const second = beginAutocompleteRequest("user:guild");

    assert.strictEqual(isLatestAutocompleteRequest("user:guild", first), false);
    assert.strictEqual(isLatestAutocompleteRequest("user:guild", second), true);
  });

  it("includes SoundCloud in playback fallback queries", () => {
    const queries = buildFallbackQueries({ title: "Kuki Cieple Dranie", author: "Example Artist" });
    assert.strictEqual(queries[0].source, "scsearch");
    assert.ok(queries[0].query.includes("Kuki Cieple Dranie"));
  });

  it("aggregates all providers so an exact popular match is not hidden by the preferred source", async () => {
    clearSearchCache();
    const calls = [];
    const poru = {
      resolve: async ({ query }) => {
        calls.push(query);
        if (query.startsWith("ytsearch:")) {
          return { tracks: [{ info: { title: "Hit 'Em Up", author: "2Pac" } }] };
        }
        return { tracks: [{ info: { title: "Hit Em Up", author: "Other Artist" } }] };
      },
    };

    const tracks = await searchAcrossSources(poru, "hit em up", { preferredSource: "deezer" });

    assert.strictEqual(calls.length, 5);
    assert.ok(calls.includes("ytmsearch:hit em up"));
    assert.ok(calls.includes("ytsearch:hit em up"));
    assert.ok(tracks.some((track) => track.info.author === "2Pac"));
  });
});
