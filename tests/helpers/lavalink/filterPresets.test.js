const assert = require("node:assert");
const { describe, it } = require("node:test");

const { FILTER_PRESET_NAMES, getFilterPreset } = require("../../../helpers/lavalink/filterPresets");
const {
  SAFE_EQ_MAX_GAIN,
  getEqualizerPreamp,
  normalizeEqualizerBands,
  toLavalinkFilters,
} = require("../../../helpers/lavalink/filters");

describe("Audio filter presets", () => {
  it("contains the branded fun and popular effects", () => {
    for (const name of ["nightcore", "vaporwave", "eightd", "karaoke", "wobble", "meme", "robot"]) {
      assert.ok(FILTER_PRESET_NAMES.includes(name));
      assert.ok(getFilterPreset(name)?.filters);
    }
  });

  it("does not send internal preset labels to Lavalink", () => {
    const payload = toLavalinkFilters({
      equalizer: [],
      preset: "flat",
      filterPreset: "nightcore",
      eqPreamp: true,
      timescale: { speed: 1.18, pitch: 1.08, rate: 1 },
    });

    assert.deepStrictEqual(payload, {
      equalizer: [],
      timescale: { speed: 1.18, pitch: 1.08, rate: 1 },
    });
  });

  it("accepts a Flat array payload and caps boosts before Lavalink receives them", () => {
    assert.deepStrictEqual(normalizeEqualizerBands([]), []);
    assert.deepStrictEqual(normalizeEqualizerBands([{ band: 0, gain: 99 }]), [{ band: 0, gain: SAFE_EQ_MAX_GAIN }]);
  });

  it("adds conservative headroom only when EQ boosts a band", () => {
    assert.strictEqual(getEqualizerPreamp([]), null);
    assert.strictEqual(getEqualizerPreamp([{ band: 0, gain: -0.25 }]), null);
    assert.ok(getEqualizerPreamp([{ band: 0, gain: SAFE_EQ_MAX_GAIN }]) < 1);
  });
});
