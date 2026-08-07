const DEFAULT_SOURCE_GAIN_DB = Object.freeze({
  deezer: 0,
  spotify: -1,
  youtube: -1.5,
  soundcloud: -2.5,
});

function normalizeSource(sourceOrTrack) {
  const source = typeof sourceOrTrack === "string" ? sourceOrTrack : sourceOrTrack?.info?.sourceName;
  return String(source || "unknown").toLowerCase();
}

function isLoudnessNormalizationEnabled() {
  return !["0", "false", "off", "no"].includes(String(process.env.LOUDNESS_NORMALIZATION || "true").toLowerCase());
}

function getSourceGainDb(sourceOrTrack) {
  const source = normalizeSource(sourceOrTrack);
  const envKey = `LOUDNESS_${source.toUpperCase()}_DB`;
  const configured = Number(process.env[envKey]);
  if (Number.isFinite(configured)) return Math.max(-12, Math.min(6, configured));
  return DEFAULT_SOURCE_GAIN_DB[source] ?? 0;
}

function getSourceVolumeMultiplier(sourceOrTrack) {
  return 10 ** (getSourceGainDb(sourceOrTrack) / 20);
}

function getUserVolume(player) {
  const configured = Number(player?.userVolume);
  if (Number.isFinite(configured)) return Math.max(0, Math.min(1000, configured));

  const current = Number(player?.volume);
  if (Number.isFinite(current)) return Math.max(0, Math.min(1000, current));

  const fallback = Number(process.env.DEFAULT_VOLUME ?? 50);
  return Number.isFinite(fallback) ? Math.max(0, Math.min(1000, fallback)) : 50;
}

function getNormalizedVolume(userVolume, sourceOrTrack) {
  const base = Math.max(0, Math.min(1000, Number(userVolume) || 0));
  if (!isLoudnessNormalizationEnabled()) return Math.round(base);
  return Math.max(0, Math.min(1000, Math.round(base * getSourceVolumeMultiplier(sourceOrTrack))));
}

async function applyNormalizedVolume(player, track = player?.currentTrack) {
  if (!player?.setVolume) return null;

  const userVolume = getUserVolume(player);
  const normalizedVolume = getNormalizedVolume(userVolume, track);
  player.userVolume = userVolume;

  if (Number(player.volume) !== normalizedVolume) {
    await player.setVolume(normalizedVolume);
  }

  player.volume = normalizedVolume;
  player.volumeSource = normalizeSource(track);
  return normalizedVolume;
}

module.exports = {
  DEFAULT_SOURCE_GAIN_DB,
  applyNormalizedVolume,
  getNormalizedVolume,
  getSourceGainDb,
  getSourceVolumeMultiplier,
  getUserVolume,
  isLoudnessNormalizationEnabled,
  normalizeSource,
};
