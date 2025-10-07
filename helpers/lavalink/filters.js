const { EQUALIZER_PRESETS } = require("./constants");
const { equalizerState, setEqualizerState } = require("./equalizerStore");
const { getPlayer } = require("./players");
const { clearInactivityTimer } = require("./timers");

async function lavalinkSetEqualizer(guildId, presetOrBands) {
  const player = getPlayer(guildId);

  if (!player) return { status: "no_player" };

  const normalize = (bands = []) =>
    bands
      .filter(Boolean)
      .map(({ band, gain }) => ({
        band: Number(band),
        gain: Math.max(-0.25, Math.min(1, Number(gain))),
      }))
      .filter((b) => Number.isInteger(b.band) && b.band >= 0 && b.band <= 14);

  const bands = Array.isArray(presetOrBands)
    ? normalize(presetOrBands)
    : normalize(EQUALIZER_PRESETS[presetOrBands?.toLowerCase()] ?? []);

  if (!bands.length && presetOrBands && !EQUALIZER_PRESETS[presetOrBands?.toLowerCase()])
    return { status: "invalid_preset" };

  const current = equalizerState.get(guildId) ?? {};
  const nextFilters = {
    ...current,
    equalizer: bands,
  };

  await player.node.rest.updatePlayer({
    guildId,
    data: { filters: nextFilters },
  });

  setEqualizerState(guildId, nextFilters);
  player.filters = nextFilters;
  clearInactivityTimer(guildId, "setEqualizer");

  return { status: "ok", filters: nextFilters };
}

async function lavalinkResetFilters(guildId) {
  const player = getPlayer(guildId);

  if (!player) return { status: "no_player" };

  const baseline = { ...(player.filters ?? {}) };
  delete baseline.equalizer;

  await player.node.rest.updatePlayer({
    guildId,
    data: { filters: { ...baseline, equalizer: [] } },
  });

  const resetFilters = { ...baseline, equalizer: [] };
  setEqualizerState(guildId, resetFilters);
  player.filters = resetFilters;
  clearInactivityTimer(guildId, "resetFilters");

  return { status: "ok" };
}

module.exports = {
  lavalinkSetEqualizer,
  lavalinkResetFilters,
};
