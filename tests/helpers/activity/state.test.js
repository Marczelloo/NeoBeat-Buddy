const assert = require("node:assert/strict");
const test = require("node:test");
const { serializeFilters, serializeLyrics, serializePlaylistDetails, serializeTrack } = require("../../../helpers/activity/state");

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

  test("uses canonical autoplay metadata for display without changing provider identity", () => {
    const track = serializeTrack({
      info: { identifier: "youtube-id", title: "TACONAFIDE - Kryptowaluty (audio)", author: "Kamil Taconafide", sourceName: "youtube" },
      userData: { autoplay: true, autoplayReference: { title: "Kryptowaluty", artist: "TACONAFIDE" } },
    });

    assert.equal(track.title, "Kryptowaluty");
    assert.equal(track.author, "TACONAFIDE");
    assert.equal(track.source, "youtube");
  });

  test("keeps provider explicit metadata available for Activity result badges", () => {
    const track = serializeTrack({
      info: { identifier: "explicit-id", title: "Uncut Version", author: "Artist", sourceName: "spotify", isExplicit: true },
    });

    assert.equal(track.explicit, true);
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

  test("serializes editable playlist tracks with artwork and source metadata", () => {
    const playlist = serializePlaylistDetails({
      id: "playlist-1",
      name: "Night Drive",
      type: "user",
      tracks: [{ title: "Tamagotchi", author: "TACONAFIDE", identifier: "sc-1", source: "soundcloud", length: 205000, artworkUrl: "https://i1.sndcdn.com/art.jpg", addedAt: 1700000000000 }],
    });

    assert.equal(playlist.trackCount, 1);
    assert.equal(playlist.tracks[0].source, "soundcloud");
    assert.equal(playlist.tracks[0].artworkUrl, "https://i1.sndcdn.com/art.jpg");
    assert.equal(playlist.tracks[0].addedAt, 1700000000000);
  });
});
