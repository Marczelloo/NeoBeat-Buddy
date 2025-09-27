const { inspect } = require('node:util');
const Log = require('../logs/log');

const isValidPayload = (payload) =>
  payload &&
  typeof payload === 'object' &&
  !Number.isInteger(payload.status); // plugin sets status=404 on misses

async function safeGet(rest, path) {
  try {
    return await rest.get(path);
  } catch (err) {
    Log.warning('Lyrics plugin request failed', '', `endpoint=${path}`, `error=${err?.message || err}`);
    return null;
  }
}

async function fetchLyricsFromNode(player, trackInfo = {}) {
  const rest = player?.node?.rest;
  if (!rest) {
    Log.warning('Lyrics fetch skipped', '', 'reason=no-rest-client', `guild=${player?.guildId || 'unknown'}`);
    return null;
  }

  const guildId = player.guildId;

  // 1. Try direct lookup by the identifier (YouTube video id for yt tracks)
  const identifier = trackInfo.identifier || trackInfo.uri;
  if (identifier) {
    const videoId = identifier.split('?')[0].split('/').pop();
    const direct = await safeGet(rest, `/v4/lyrics/${encodeURIComponent(videoId)}`);
    if (isValidPayload(direct)) {
      Log.info('Lyrics fetched via direct video id', '', `guild=${guildId}`, `videoId=${videoId}`);
      return direct;
    }
  }

  // 2. Fallback: search by title/artist/duration
  const title = trackInfo.title?.trim() || '';
  const artist = trackInfo.author?.trim() || '';
  const searchTerm = [artist, title].filter(Boolean).join(' ').trim();

  if (!searchTerm) {
    Log.warning('Lyrics search skipped', '', `guild=${guildId}`, 'reason=missing-metadata');
    return null;
  }

  const matches = await safeGet(rest, `/v4/lyrics/search/${encodeURIComponent(searchTerm)}`);
  if (!Array.isArray(matches) || matches.length === 0) {
    Log.warning('Lyrics search returned no matches', '', `guild=${guildId}`, `query=${searchTerm}`);
    return null;
  }

  for (const match of matches) {
    if (!match?.videoId) continue;
    const candidate = await safeGet(rest, `/v4/lyrics/${encodeURIComponent(match.videoId)}`);
    if (isValidPayload(candidate)) {
      Log.info('Lyrics fetched via search match', '', `guild=${guildId}`, `videoId=${match.videoId}`);
      return candidate;
    }
  }

  Log.warning(
    'Lyrics lookup exhausted matches',
    '',
    `guild=${guildId}`,
    `query=${searchTerm}`,
    `matches=${inspect(matches, { depth: 1 })}`
  );
  return null;
}

module.exports = { fetchLyricsFromNode };
