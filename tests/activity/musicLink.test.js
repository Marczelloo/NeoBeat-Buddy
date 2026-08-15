const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

let parseMusicLink;

test.before(async () => {
  ({ parseMusicLink } = await import(pathToFileURL(path.resolve(__dirname, "../../activity/src/musicLink.js")).href));
});

test("pasted provider links retain their originating provider", () => {
  assert.equal(parseMusicLink("https://www.youtube.com/watch?v=abc").source, "youtube");
  assert.equal(parseMusicLink("https://on.soundcloud.com/example").source, "soundcloud");
  assert.equal(parseMusicLink("https://open.spotify.com/track/example").source, "spotify");
  assert.equal(parseMusicLink("https://deezer.page.link/example").source, "deezer");
});

test("a direct HTTP URL is retained while normal search text is not treated as a link", () => {
  assert.deepEqual(parseMusicLink("https://radio.example.test/live"), {
    url: "https://radio.example.test/live",
    source: "direct",
    hostname: "radio.example.test",
  });
  assert.equal(parseMusicLink("Kuki Ciepłe Dranie"), null);
  assert.equal(parseMusicLink("spotify:track:abc"), null);
});
