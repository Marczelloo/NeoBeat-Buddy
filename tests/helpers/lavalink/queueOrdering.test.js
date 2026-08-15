const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  addManualTracksToQueue,
  isAutoplayTrack,
  markManualTrack,
  moveQueueTrackWithinOrigin,
  normalizeQueueAutoplayPartition,
} = require("../../../helpers/lavalink/queueOrdering");

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
    const requested = [track("Manual 1"), track("Manual 2")];

    addManualTracksToQueue(player, requested);

    assert.deepStrictEqual(
      player.queue.map((item) => item.info.title),
      ["Manual 1", "Manual 2", "Auto 1"]
    );
    assert.ok(requested.every((item) => item.userData.manual === true));
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

  it("repairs a mixed queue without losing autoplay metadata", () => {
    const queue = [track("Auto 1", true), track("Manual 1"), track("Auto 2", true), track("Manual 2")];

    normalizeQueueAutoplayPartition(queue);

    assert.deepStrictEqual(queue.map((item) => item.info.title), ["Manual 1", "Manual 2", "Auto 1", "Auto 2"]);
    assert.strictEqual(isAutoplayTrack(queue[2]), true);
  });

  it("keeps drag reordering inside the originating queue segment", () => {
    const queue = [track("Manual 1"), track("Manual 2"), track("Auto 1", true), track("Auto 2", true)];

    moveQueueTrackWithinOrigin(queue, 0, 3);
    assert.deepStrictEqual(queue.map((item) => item.info.title), ["Manual 2", "Manual 1", "Auto 1", "Auto 2"]);

    moveQueueTrackWithinOrigin(queue, 3, 0);
    assert.deepStrictEqual(queue.map((item) => item.info.title), ["Manual 2", "Manual 1", "Auto 2", "Auto 1"]);
  });

  it("turns a deliberately promoted autoplay track into a manual request", () => {
    const auto = track("Auto 1", true);
    markManualTrack(auto);

    assert.strictEqual(isAutoplayTrack(auto), false);
    assert.strictEqual(auto.info.autoplayed, false);
    assert.strictEqual(auto.userData.manual, true);
  });
});
