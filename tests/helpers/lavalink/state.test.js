const assert = require("node:assert/strict");
const test = require("node:test");

const {
  playbackState,
  ensurePlaybackState,
  pushTrackHistory,
  endActivePlayback,
} = require("../../../helpers/lavalink/state");

function track(identifier) {
  return {
    track: `encoded-${identifier}`,
    info: { identifier, title: `Track ${identifier}`, author: "MewBit", length: 180_000 },
  };
}

test("ending active playback keeps room history after the live player is gone", () => {
  const guildId = "playback-history-retention";
  playbackState.delete(guildId);

  const state = ensurePlaybackState(guildId);
  state.currentTrack = track("current");
  state.lastEndedTrack = track("ended");
  state.lastPosition = 51_000;
  state.paused = false;
  pushTrackHistory(guildId, track("first"));
  pushTrackHistory(guildId, track("second"));

  const ended = endActivePlayback(guildId);

  assert.equal(ended.currentTrack, null);
  assert.equal(ended.lastEndedTrack, null);
  assert.equal(ended.lastPosition, 0);
  assert.equal(ended.paused, true);
  assert.deepEqual(ended.history.map((entry) => entry.info.identifier), ["first", "second"]);

  playbackState.delete(guildId);
});
