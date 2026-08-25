const assert = require("node:assert/strict");
const test = require("node:test");
const { assertAllowedMusicUrl, isAllowedMusicUrl } = require("../../../helpers/security/mediaUrl");

test("music URL guard accepts supported HTTPS providers", () => {
  assert.equal(isAllowedMusicUrl("https://www.youtube.com/watch?v=track"), true);
  assert.equal(isAllowedMusicUrl("https://open.spotify.com/track/track"), true);
  assert.doesNotThrow(() => assertAllowedMusicUrl("https://soundcloud.com/artist/track"));
});

test("music URL guard rejects local, untrusted, and HTTP direct URLs", () => {
  assert.equal(isAllowedMusicUrl("http://127.0.0.1:8787/private"), false);
  assert.equal(isAllowedMusicUrl("https://example.test/audio"), false);
  assert.throws(() => assertAllowedMusicUrl("http://169.254.169.254/latest/meta-data"), /not allowed/i);
  assert.throws(() => assertAllowedMusicUrl("https://example.test/audio"), /not allowed/i);
});
