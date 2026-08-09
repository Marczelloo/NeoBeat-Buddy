const assert = require("node:assert");
const { afterEach, describe, it } = require("node:test");

const { clearLastFmTagCache, getLastFmTrackTags } = require("../../../helpers/lavalink/lastfmClient");

const originalFetch = global.fetch;
const originalKey = process.env.LASTFM_API_KEY;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.LASTFM_API_KEY;
  else process.env.LASTFM_API_KEY = originalKey;
  clearLastFmTagCache();
});

describe("Last.fm tag enrichment", () => {
  it("normalizes before applying the requested tag limit", async () => {
    process.env.LASTFM_API_KEY = "test-key";
    let requestedLimit = null;
    global.fetch = async (url) => {
      requestedLimit = new URL(url).searchParams.get("limit");
      return {
        ok: true,
        json: async () => ({
          toptags: {
            tag: [
              { name: "seen live", count: 100 },
              { name: "favorite", count: 90 },
              { name: "2020s", count: 80 },
              { name: "Pop", count: 70 },
              { name: "Synth Pop", count: 60 },
            ],
          },
        }),
      };
    };

    const tags = await getLastFmTrackTags({ artist: "Test Artist", title: "Test Track", limit: 2 });
    assert.strictEqual(requestedLimit, "24");
    assert.deepStrictEqual(tags, ["pop", "synthpop"]);
  });
});
