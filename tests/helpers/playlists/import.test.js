const assert = require("node:assert/strict");
const test = require("node:test");

const { detectPlaylistSource } = require("../../../helpers/playlists/import");

test("detects supported Activity playlist import sources", () => {
  assert.equal(detectPlaylistSource("https://open.spotify.com/playlist/abc"), "spotify");
  assert.equal(detectPlaylistSource("https://www.youtube.com/playlist?list=abc"), "youtube");
  assert.equal(detectPlaylistSource("https://soundcloud.com/user/sets/night-drive"), "soundcloud");
  assert.equal(detectPlaylistSource("https://www.deezer.com/playlist/123"), "deezer");
  assert.equal(detectPlaylistSource("https://example.com/not-a-playlist"), null);
});
