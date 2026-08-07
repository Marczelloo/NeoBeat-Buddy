const { EQUALIZER_PRESETS } = require("./constants");
const { equalizerState, setEqualizerState } = require("./equalizerStore");
const { getFilterPreset } = require("./filterPresets");
const { getPlayer } = require("./players");
const { clearInactivityTimer } = require("./timers");

const EFFECT_FILTER_KEYS = [
  "karaoke",
  "timescale",
  "tremolo",
  "vibrato",
  "rotation",
  "distortion",
  "channelMix",
  "lowPass",
];

function toLavalinkFilters(filters) {
  const payload = { ...(filters || {}) };
  delete payload.preset;
  delete payload.filterPreset;
  return payload;
}

function getStoredFilters(guildId, player) {
  return { ...(equalizerState.get(String(guildId)) ?? player.filters ?? {}) };
}

async function applyFilters(guildId, player, nextFilters, reason) {
  const payload = toLavalinkFilters(nextFilters);

  await player.node.rest.updatePlayer({
    guildId,
    data: { filters: payload },
  });

  setEqualizerState(guildId, nextFilters);
  player.filters = nextFilters;
  clearInactivityTimer(guildId, reason);

  return { status: "ok", filters: nextFilters };
}

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

  const current = getStoredFilters(guildId, player);
  const nextFilters = {
    ...current,
    equalizer: bands,
    preset: Array.isArray(presetOrBands) ? "custom" : String(presetOrBands || "flat").toLowerCase(),
  };

  return applyFilters(guildId, player, nextFilters, "setEqualizer");
}

async function lavalinkResetFilters(guildId) {
  const player = getPlayer(guildId);

  if (!player) return { status: "no_player" };

  const baseline = getStoredFilters(guildId, player);
  delete baseline.equalizer;

  const resetFilters = { ...baseline, equalizer: [] };
  resetFilters.preset = "flat";
  return applyFilters(guildId, player, resetFilters, "resetFilters");
}

async function lavalinkSetFilterPreset(guildId, presetName) {
  const player = getPlayer(guildId);

  if (!player) return { status: "no_player" };

  const preset = getFilterPreset(presetName);
  if (!preset) return { status: "invalid_preset" };

  const nextFilters = getStoredFilters(guildId, player);
  EFFECT_FILTER_KEYS.forEach((key) => delete nextFilters[key]);
  Object.assign(nextFilters, preset.filters, { filterPreset: preset.name });

  return applyFilters(guildId, player, nextFilters, "setFilterPreset");
}

async function lavalinkResetEffects(guildId) {
  const player = getPlayer(guildId);

  if (!player) return { status: "no_player" };

  const nextFilters = getStoredFilters(guildId, player);
  EFFECT_FILTER_KEYS.forEach((key) => delete nextFilters[key]);
  delete nextFilters.filterPreset;

  return applyFilters(guildId, player, nextFilters, "resetEffects");
}

function getCurrentFilterName(guildId) {
  return equalizerState.get(String(guildId))?.filterPreset || "off";
}

module.exports = {
  EFFECT_FILTER_KEYS,
  getCurrentFilterName,
  lavalinkSetEqualizer,
  lavalinkSetFilterPreset,
  lavalinkResetEffects,
  lavalinkResetFilters,
  toLavalinkFilters,
};
