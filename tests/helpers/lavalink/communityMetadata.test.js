const assert = require("node:assert");
const { afterEach, describe, it } = require("node:test");

const {
  findExactRecording,
  clearCommunityMetadataCache,
  getCommunityMetadata,
  normalizeAudioDbMetadata,
  normalizeMusicBrainzMetadata,
} = require("../../../helpers/lavalink/communityMetadata");

const originalFetch = global.fetch;
const originalLastFmKey = process.env.LASTFM_API_KEY;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalLastFmKey === undefined) delete process.env.LASTFM_API_KEY;
  else process.env.LASTFM_API_KEY = originalLastFmKey;
  clearCommunityMetadataCache();
});

describe("community autoplay metadata", () => {
  it("keeps only a recording that matches both title and artist", () => {
    const match = findExactRecording(
      [
        { id: "wrong", title: "Tamagotchi", "artist-credit": [{ name: "Die Ärzte" }] },
        { id: "right", title: "Tamagotchi", "artist-credit": [{ name: "TACONAFIDE" }] },
      ],
      { artist: "Taconafide", title: "Tamagotchi" }
    );
    assert.strictEqual(match.id, "right");
  });

  it("normalizes MusicBrainz genres and preserves useful release identifiers", () => {
    const metadata = normalizeMusicBrainzMetadata({
      genres: [{ name: "Hip Hop" }],
      tags: [{ name: "seen live", count: 10 }, { name: "Polish rap", count: 2 }],
      releases: [{ date: "2018-04-13" }],
      isrcs: ["PL1234567890"],
    });
    assert.deepStrictEqual(metadata.genres, ["hiphop", "polish rap"]);
    assert.strictEqual(metadata.releaseYear, 2018);
    assert.strictEqual(metadata.isrc, "PL1234567890");
  });

  it("extracts TheAudioDB genre and mood fields without treating them as measured audio features", () => {
    const metadata = normalizeAudioDbMetadata({
      strGenre: "Electronic; Synthpop",
      strStyle: "Dance pop",
      strMood: "Energetic, Euphoric",
      intYearReleased: "2020",
    });
    assert.deepStrictEqual(metadata.genres, ["electronic", "synthpop", "dance pop"]);
    assert.deepStrictEqual(metadata.moodTags, ["energetic", "euphoric"]);
    assert.strictEqual(metadata.releaseYear, 2020);
  });

  it("uses MusicBrainz only after a sparse Last.fm profile and merges verified recording tags", async () => {
    delete process.env.LASTFM_API_KEY;
    const calls = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("recording?")) {
        return {
          ok: true,
          json: async () => ({ recordings: [{ id: "recording-id", title: "Rare Track", "artist-credit": [{ name: "Rare Artist" }] }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({ genres: [{ name: "Dream Pop" }], tags: [{ name: "shoegaze", count: 1 }], isrcs: ["TESTISRC"] }),
      };
    };

    const metadata = await getCommunityMetadata({ artist: "Rare Artist", title: "Rare Track" });

    assert.deepStrictEqual(metadata.genres, ["dream pop", "shoegaze"]);
    assert.deepStrictEqual(metadata.metadataSources, ["musicbrainz"]);
    assert.strictEqual(metadata.isrc, "TESTISRC");
    assert.strictEqual(calls.length, 2);
  });

  it("uses TheAudioDB only after Last.fm and MusicBrainz both remain sparse", async () => {
    delete process.env.LASTFM_API_KEY;
    global.fetch = async (url) => {
      if (String(url).includes("recording?")) {
        return {
          ok: true,
          json: async () => ({ recordings: [{ id: "recording-id", title: "Rare Track", "artist-credit": [{ name: "Rare Artist" }] }] }),
        };
      }
      if (String(url).includes("musicbrainz.org/ws/2/recording/")) return { ok: true, json: async () => ({}) };
      return {
        ok: true,
        json: async () => ({ track: [{ strTrack: "Rare Track", strArtist: "Rare Artist", strGenre: "Trip Hop", strMood: "Moody" }] }),
      };
    };

    const metadata = await getCommunityMetadata({ artist: "Rare Artist", title: "Rare Track" });

    assert.deepStrictEqual(metadata.genres, ["trip hop"]);
    assert.deepStrictEqual(metadata.moodTags, ["moody"]);
    assert.deepStrictEqual(metadata.metadataSources, ["musicbrainz", "theaudiodb"]);
  });
});
