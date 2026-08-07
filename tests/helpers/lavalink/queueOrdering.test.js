const assert = require("node:assert");
const { describe, it } = require("node:test");

const { addManualTracksToQueue, isAutoplayTrack } = require("../../../helpers/lavalink/queueOrdering");

function track(title, autoplay = false) {
  return {
    info: { title, autoplayed: autoplay },
    userData: { autoplay },
  };
}

describe("Queue ordering", () => {
  it("inserts manual tracks before the autoplay buffer", () => {
    const player = { queue: [track("Manual 1"), track("Auto 1", true), track("Auto 2", true)] };

    addManualTracksToQueue(player, [track("Manual 2")]);

    assert.deepStrictEqual(
      player.queue.map((item) => item.info.title),
      ["Manual 1", "Manual 2", "Auto 1", "Auto 2"]
    );
  });

  it("keeps several manual tracks in their requested order", () => {
    const player = { queue: [track("Auto 1", true)] };

    addManualTracksToQueue(player, [track("Manual 1"), track("Manual 2")]);

    assert.deepStrictEqual(
      player.queue.map((item) => item.info.title),
      ["Manual 1", "Manual 2", "Auto 1"]
    );
  });

  it("appends normally when there is no autoplay track", () => {
    const player = { queue: [track("Manual 1")] };

    addManualTracksToQueue(player, [track("Manual 2")]);

    assert.deepStrictEqual(
      player.queue.map((item) => item.info.title),
      ["Manual 1", "Manual 2"]
    );
  });

  it("recognizes both autoplay metadata markers", () => {
    assert.strictEqual(isAutoplayTrack(track("A", true)), true);
    assert.strictEqual(isAutoplayTrack({ userData: { autoplay: true } }), true);
    assert.strictEqual(isAutoplayTrack(track("Manual")), false);
  });
});
