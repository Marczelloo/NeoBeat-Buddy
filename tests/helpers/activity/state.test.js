const test = require("node:test");
const assert = require("node:assert/strict");
const { serializeFilters, serializeLyrics, serializeTrack } = require("../../../helpers/activity/state");

test.describe("Activity state serialization", () => {
  test("exposes safe track metadata and preserves provider identity", () => {
    const track = serializeTrack({
      track: "encoded-track",
      info: {
        identifier: "sc-123",
        title: "Ciepłe Dranie",
        author: "Kuki",
        length: 189000,
        sourceName: "soundcloud",
        uri: "https://soundcloud.com/kuki/cieple-dranie",
        artworkUrl: "https://example.test/art.jpg",
      },
      userData: { autoplay: true },
    });

    assert.deepEqual(
      {
        id: track.id,
        title: track.title,
        author: track.author,
        durationMs: track.durationMs,
        source: track.source,
        autoplay: track.autoplay,
      },
      {
        id: "sc-123",
        title: "Ciepłe Dranie",
        author: "Kuki",
        durationMs: 189000,
        source: "soundcloud",
        autoplay: true,
      }
    );
  });

  test("normalizes synced and static lyrics into an Activity payload", () => {
    const synced = serializeLyrics({ source: "LRCLIB", synced: true, lyrics: "one\ntwo", lines: [{ timestamp: 1200, line: "one" }] });
    const staticLyrics = serializeLyrics({ source: "Genius", synced: false, lyrics: "full text" });

    assert.equal(synced.provider, "LRCLIB");
    assert.equal(synced.lines[0].timestamp, 1200);
    assert.equal(synced.synced, true);
    assert.equal(staticLyrics.text, "full text");
    assert.deepEqual(staticLyrics.lines, []);
  });

  test("keeps EQ and effect labels separate from Lavalink payload details", () => {
    assert.deepEqual(
      serializeFilters({ preset: "rnb", filterPreset: "vaporwave", equalizer: [{ band: 3, gain: 0.22 }] }),
      { preset: "rnb", effectPreset: "vaporwave", equalizer: [{ band: 3, gain: 0.22 }] }
    );
  });
});
