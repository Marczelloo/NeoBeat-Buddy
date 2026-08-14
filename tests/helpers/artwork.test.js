const assert = require("node:assert/strict");
const test = require("node:test");

const { getArtworkUrls, getHighResolutionArtworkUrl, getTrackArtworkSource } = require("../../helpers/artwork");

test("upgrades known provider artwork URLs without dropping their fallback", () => {
  assert.equal(
    getHighResolutionArtworkUrl("https://cdn-images.dzcdn.net/images/cover/id/500x500-000000-80-0-0.jpg"),
    "https://cdn-images.dzcdn.net/images/cover/id/1000x1000-000000-80-0-0.jpg"
  );
  assert.equal(
    getHighResolutionArtworkUrl("https://i.scdn.co/image/ab67616d00001e02abcdef"),
    "https://i.scdn.co/image/ab67616d0000b273abcdef"
  );
  assert.equal(
    getHighResolutionArtworkUrl("https://i.ytimg.com/vi/example/hqdefault.jpg"),
    "https://i.ytimg.com/vi/example/maxresdefault.jpg"
  );

  assert.deepEqual(getArtworkUrls("https://i.ytimg.com/vi/example/hqdefault.jpg"), {
    primary: "https://i.ytimg.com/vi/example/maxresdefault.jpg",
    fallback: "https://i.ytimg.com/vi/example/hqdefault.jpg",
  });
});

test("falls back from unavailable YouTube maxres artwork to hq artwork", () => {
  assert.deepEqual(getArtworkUrls("https://i.ytimg.com/vi/example/maxresdefault.jpg"), {
    primary: "https://i.ytimg.com/vi/example/maxresdefault.jpg",
    fallback: "https://i.ytimg.com/vi/example/hqdefault.jpg",
  });
});

test("derives a high-resolution YouTube thumbnail when Lavalink omits artwork", () => {
  assert.equal(
    getTrackArtworkSource({ info: { sourceName: "youtube", identifier: "dQw4w9WgXcQ" } }),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
  );
});
