const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  DEFAULT_SOURCE_GAIN_DB,
  applyNormalizedVolume,
  getNormalizedVolume,
  getSourceVolumeMultiplier,
} = require("../../../helpers/lavalink/loudness");

describe("Provider loudness normalization", () => {
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
});
