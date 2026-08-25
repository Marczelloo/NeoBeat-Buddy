const assert = require("node:assert");
const { afterEach, describe, it } = require("node:test");

const {
  clearAutoplayMetadataCache,
  getDeezerChartTracks,
  getFeatureCoverage,
  getTempoDistance,
  mergeAudioMetadata,
  deriveCatalogFeatureHints,
  normalizeDeezerMetadata,
} = require("../../../helpers/lavalink/autoplayMetadata");
const { normalizeReleaseYear } = require("../../../helpers/lavalink/metadataValidation");

const originalFetch = global.fetch;

function candidate(title, artist, identifier, options = {}) {
  return {
    title,
    artist,
    identifier,
    genres: options.genres || ["pop", "rnb"],
    features: options.features || null,
    metadataChecked: options.metadataChecked ?? true,
    metadataConfidence: options.metadataConfidence ?? 0.45,
  };
}

describe("Autoplay metadata without Spotify audio features", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    clearAutoplayMetadataCache();
  });

  it("derives low-confidence mood hints without pretending they are measured audio features", () => {
    const hints = deriveCatalogFeatureHints(
      candidate("Summer Dance", "Artist", "id", {
        genres: ["dance pop", "party"],
        features: { tempo: 124, loudness: -7 },
      })
    );

    assert.ok(hints.energy > 0.5 && hints.energy < 1);
    assert.ok(hints.valence > 0.5);
    assert.ok(hints.danceability > 0.4);
  });

  it("normalizes Deezer catalog fields without inventing mood features", () => {
    const metadata = normalizeDeezerMetadata({
      id: 123,
      bpm: 118.2,
      gain: -8.3,
      rank: 907086,
      isrc: "US123",
      release_date: "2021-05-20",
      track_position: 3,
      disk_number: 1,
      artist: { id: 7 },
      album: { id: 99, title: "Test Album" },
    });

    assert.deepStrictEqual(metadata.features, { tempo: 118.2, loudness: -8.3 });
    assert.strictEqual(metadata.deezerId, "123");
    assert.strictEqual(metadata.releaseYear, 2021);
    assert.strictEqual(metadata.metadataProvider, "deezer");
    assert.strictEqual(metadata.albumId, "99");
    assert.strictEqual(metadata.albumTitle, "Test Album");
    assert.strictEqual(metadata.trackPosition, 3);
    assert.strictEqual(getFeatureCoverage(metadata.features), 1);
  });

  it("compares half-time and double-time BPMs, but ignores invalid values", () => {
    assert.strictEqual(getTempoDistance(108, 112), 4);
    assert.strictEqual(getTempoDistance(108, 216), 0);
    assert.strictEqual(getTempoDistance(108, 0), null);
  });

  it("merges catalog tempo without overwriting richer existing metadata", () => {
    const track = candidate("Track", "Artist", "id", { features: { tempo: 108, energy: 0.7 } });
    mergeAudioMetadata(track, {
      deezerId: "42",
      features: { tempo: 112, loudness: -8 },
      metadataConfidence: 0.45,
      metadataProvider: "deezer",
    });

    assert.deepStrictEqual(track.features, { tempo: 108, energy: 0.7, loudness: -8 });
    assert.strictEqual(track.deezerId, "42");
    assert.strictEqual(track.metadataChecked, true);
  });

  it("drops impossible release years before they enter the session profile", () => {
    const fixedNow = new Date("2026-08-13T00:00:00Z");
    assert.strictEqual(normalizeReleaseYear(1, fixedNow), null);
    assert.strictEqual(normalizeReleaseYear("1735-01-01", fixedNow), null);
    assert.strictEqual(normalizeReleaseYear("2024-05-10", fixedNow), 2024);
    assert.strictEqual(normalizeReleaseYear(2028, fixedNow), null);
  });

  it("normalizes and caches fresh Deezer chart tracks for Surprise Me", async () => {
    let requests = 0;
    global.fetch = async () => {
      requests += 1;
      return {
        ok: true,
        json: async () => ({
          data: [{
            id: 42,
            title: "Fresh Signal",
            duration: 183,
            rank: 850000,
            artist: { id: 9, name: "Neon Artist" },
            album: { id: 7, title: "Tonight", cover_xl: "https://cdn.example.test/cover.jpg" },
          }],
        }),
      };
    };

    const first = await getDeezerChartTracks(1);
    const second = await getDeezerChartTracks(1);

    assert.strictEqual(requests, 1);
    assert.deepStrictEqual(first[0], {
      deezerId: "42",
      artist: "Neon Artist",
      artistId: "9",
      title: "Fresh Signal",
      duration: 183000,
      albumId: "7",
      albumTitle: "Tonight",
      artworkUrl: "https://cdn.example.test/cover.jpg",
      catalogRank: 850000,
      popularity: 85,
    });
    assert.deepStrictEqual(second, first);
  });
});
