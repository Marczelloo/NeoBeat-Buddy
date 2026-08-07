const assert = require("node:assert");
const { describe, it } = require("node:test");

const { FILTER_PRESET_NAMES, getFilterPreset } = require("../../../helpers/lavalink/filterPresets");
const { toLavalinkFilters } = require("../../../helpers/lavalink/filters");

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
      timescale: { speed: 1.18, pitch: 1.08, rate: 1 },
    });

    assert.deepStrictEqual(payload, {
      equalizer: [],
      timescale: { speed: 1.18, pitch: 1.08, rate: 1 },
    });
  });
});
