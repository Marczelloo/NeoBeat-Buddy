const assert = require("node:assert");
const { describe, it, beforeEach } = require("node:test");

describe("Autoplay reservation history", () => {
  const guildId = "autoplay-history-test";

  function createTrack(index) {
    return {
      track: `encoded-${index}`,
      info: {
        title: `Song ${index}`,
        author: "Artist",
        identifier: `id-${index}`,
        length: 180000,
      },
    };
  }

  beforeEach(() => {
    delete require.cache[require.resolve("../../../helpers/lavalink/state")];
    const state = require("../../../helpers/lavalink/state");
    state.playbackState.clear();
  });

  it("keeps a bounded cooldown window and moves a repeated identity to the end", () => {
    const state = require("../../../helpers/lavalink/state");

    for (let index = 0; index < 81; index += 1) {
      state.rememberAutoplayTrack(guildId, createTrack(index));
    }

    let playback = state.playbackState.get(guildId);
    assert.strictEqual(playback.autoplayHistory.length, 80);
    assert.strictEqual(playback.autoplayHistory[0].track.info.identifier, "id-1");

    state.rememberAutoplayTrack(guildId, createTrack(10));
    playback = state.playbackState.get(guildId);
    assert.strictEqual(playback.autoplayHistory.length, 80);
    assert.strictEqual(playback.autoplayHistory.at(-1).track.info.identifier, "id-10");
  });
});
