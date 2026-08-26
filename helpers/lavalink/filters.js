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

// Lavalink accepts gains up to 1.0, but 0.25 is already roughly +6 dB. The
// old +0.20 cap required a 45% preamp cut, which made every EQ preset sound
// muffled. These limits preserve an audible tonal change while keeping enough
// headroom for normal Discord playback.
const SAFE_EQ_MIN_GAIN = -0.2;
const SAFE_EQ_MAX_GAIN = 0.14;
const EQ_HEADROOM_FLOOR = 0.82;

function toLavalinkFilters(filters) {
  const payload = { ...(filters || {}) };
  delete payload.preset;
  delete payload.filterPreset;
  delete payload.eqPreamp;
  return payload;
}

function normalizeEqualizerBands(bands = []) {
  return bands
    .filter(Boolean)
    .map(({ band, gain }) => ({
      band: Number(band),
      gain: Math.max(SAFE_EQ_MIN_GAIN, Math.min(SAFE_EQ_MAX_GAIN, Number(gain))),
    }))
    .filter((entry) => Number.isInteger(entry.band) && entry.band >= 0 && entry.band <= 14);
}

function getEqualizerPreamp(bands = []) {
  const peakGain = Math.max(0, ...bands.map((band) => Number(band.gain) || 0));
  if (peakGain <= 0) return null;

  // Avoid a whole-track "muffle" for modest tonal shaping. The strongest
  // supported boost gets a restrained ~1 dB safety reduction, rather than
  // the previous -5 dB cut. Lavalink's player volume remains the user's
  // primary loudness control.
  return Math.max(EQ_HEADROOM_FLOOR, Number((1 - peakGain * 0.85).toFixed(3)));
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

  const isBandArray = Array.isArray(presetOrBands);
  const presetName = isBandArray && presetOrBands.length ? "custom" : String(presetOrBands || "flat").trim().toLowerCase();
  const bands = isBandArray
    ? normalizeEqualizerBands(presetOrBands)
    : normalizeEqualizerBands(EQUALIZER_PRESETS[presetName] ?? []);

  if (!bands.length && !isBandArray && presetName !== "flat" && !EQUALIZER_PRESETS[presetName])
    return { status: "invalid_preset" };

  const current = getStoredFilters(guildId, player);
  const nextFilters = {
    ...current,
    equalizer: bands,
    preset: isBandArray && bands.length ? "custom" : presetName,
  };
  const preamp = getEqualizerPreamp(bands);
  if (preamp) {
    nextFilters.volume = preamp;
    nextFilters.eqPreamp = true;
  } else if (nextFilters.eqPreamp) {
    delete nextFilters.volume;
    delete nextFilters.eqPreamp;
  }

  return applyFilters(guildId, player, nextFilters, "setEqualizer");
}

async function lavalinkResetFilters(guildId) {
  const player = getPlayer(guildId);

  if (!player) return { status: "no_player" };

  const baseline = getStoredFilters(guildId, player);
  delete baseline.equalizer;

  const resetFilters = { ...baseline, equalizer: [] };
  if (resetFilters.eqPreamp) {
    delete resetFilters.volume;
    delete resetFilters.eqPreamp;
  }
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
  SAFE_EQ_MIN_GAIN,
  SAFE_EQ_MAX_GAIN,
  normalizeEqualizerBands,
  getEqualizerPreamp,
  getCurrentFilterName,
  lavalinkSetEqualizer,
  lavalinkSetFilterPreset,
  lavalinkResetEffects,
  lavalinkResetFilters,
  toLavalinkFilters,
};
