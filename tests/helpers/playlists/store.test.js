const assert = require("node:assert/strict");
const test = require("node:test");
const { deduplicateTracks, getTrackIdentityKeys } = require("../../../helpers/playlists/store");

test("playlist track identities support Activity saves and remove legacy duplicates", () => {
  const activityTrack = { id: "youtube-track-1", title: "Loser", author: "Tame Impala" };
  const legacyTrack = { title: " loser ", author: "TAME   IMPALA" };

  assert.deepEqual(getTrackIdentityKeys(activityTrack), ["youtube-track-1", "loser::tame impala"]);
  assert.equal(deduplicateTracks([activityTrack, legacyTrack]).length, 1);
});
