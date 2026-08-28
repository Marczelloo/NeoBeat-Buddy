const assert = require("node:assert");
const { describe, it } = require("node:test");

const { lavalinkToggleMute } = require("../../../helpers/lavalink");
const {
  DEFAULT_SOURCE_GAIN_DB,
  applyNormalizedVolume,
  getNormalizedVolume,
  getSourceVolumeMultiplier,
} = require("../../../helpers/lavalink/loudness");
const { getRestoreVolume, setPlayerVolume } = require("../../../helpers/lavalink/volume");

describe("Provider loudness normalization", () => {
  it("exposes the Activity mute action through the Lavalink public API", () => {
    assert.strictEqual(typeof lavalinkToggleMute, "function");
  });

  it("keeps Deezer as the neutral reference and attenuates noisier providers", () => {
    assert.strictEqual(DEFAULT_SOURCE_GAIN_DB.deezer, 0);
    assert.strictEqual(getNormalizedVolume(100, "deezer"), 100);
    assert.ok(getSourceVolumeMultiplier("soundcloud") < 1);
    assert.ok(getNormalizedVolume(100, "soundcloud") < 100);
  });

  it("preserves the user volume while applying the provider compensation", async () => {
    const applied = [];
    const player = {
      userVolume: 80,
      volume: 80,
      setVolume: async (volume) => applied.push(volume),
    };

    const normalized = await applyNormalizedVolume(player, { info: { sourceName: "youtube" } });

    assert.strictEqual(player.userVolume, 80);
    assert.strictEqual(player.volume, normalized);
    assert.strictEqual(applied.at(-1), normalized);
    assert.ok(normalized < 80);
  });

  it("remembers the last audible volume when muted so it can be restored", async () => {
    const applied = [];
    const player = {
      userVolume: 72,
      volume: 72,
      setVolume: async (volume) => applied.push(volume),
    };

    await setPlayerVolume(player, 0);
    assert.strictEqual(player.isMuted, true);
    assert.strictEqual(player.lastAudibleVolume, 72);
    assert.strictEqual(player.userVolume, 0);
    assert.strictEqual(applied.at(-1), 0);
    assert.strictEqual(getRestoreVolume(player), 72);

    await setPlayerVolume(player, getRestoreVolume(player));
    assert.strictEqual(player.isMuted, false);
    assert.strictEqual(player.userVolume, 72);
  });
});
