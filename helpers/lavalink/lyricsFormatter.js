const { lyricsEmbed } = require("../embeds");
const { getPlayer } = require("./players");
const { playbackState } = require("./state");

const MAX_EMBED_DESCRIPTION = 1900;
const MAX_EMBEDS = 10;
const SYNCED_LINES_BEFORE = 2; // Lines to show before current
const SYNCED_LINES_AFTER = 3; // Lines to show after current
const UPDATE_INTERVAL = 250; // Check every 250ms for responsive updates

/**
 * Get accurate interpolated position for the player
 * Lavalink only sends position updates every ~5 seconds, so we interpolate
 * based on elapsed time since last update
 */
function getInterpolatedPosition(player) {
  if (!player) return 0;

  // If paused, return the stored position
  if (player.paused) {
    return player.position || 0;
  }

  const state = playbackState.get(player.guildId);
  const lastKnownPosition = state?.lastPosition ?? player.position ?? 0;
  const lastUpdateTime = state?.lastTimestamp ?? Date.now();
  const elapsed = Date.now() - lastUpdateTime;

  // Interpolate: current position = last known + time elapsed since update
  // Add a small lookahead offset (300ms) so lyrics appear slightly before the audio
  // This compensates for Discord message edit latency
  const LOOKAHEAD_MS = 300;
  const interpolated = lastKnownPosition + elapsed + LOOKAHEAD_MS;

  // Clamp to track duration
  const maxDuration = player.currentTrack?.info?.length || Infinity;
  return Math.min(interpolated, maxDuration);
}

function chunkLyrics(text, chunkSize = MAX_EMBED_DESCRIPTION) {
  if (!text) return [];

  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    flush();

    if (!line) {
      continue;
    }

    if (line.length <= chunkSize) {
      current = line;
      continue;
    }

    for (let i = 0; i < line.length; i += chunkSize) {
      chunks.push(line.slice(i, i + chunkSize));
    }
  }

  flush();

  return chunks;
}

function buildLyricsResponse({ text, provider, trackTitle }) {
  const chunks = chunkLyrics(text);

  if (chunks.length === 0) {
    return { embeds: [], content: undefined };
  }

  const totalPages = chunks.length;
  const visibleChunks = chunks.slice(0, MAX_EMBEDS);

  const embeds = visibleChunks.map((chunk, index) => {
    const pageLabel = totalPages > 1 ? `Page ${index + 1}/${totalPages}` : null;
    const footerParts = [provider ? `Provider - ${provider}` : null, pageLabel].filter(Boolean);
    const footer = footerParts.length ? footerParts.join(" | ") : undefined;
    const title = totalPages > 1 ? `${trackTitle} (Part ${index + 1})` : trackTitle;

    return lyricsEmbed(`Lyrics - ${title}`, chunk, footer);
  });

  const content =
    chunks.length > MAX_EMBEDS ? `Showing the first ${MAX_EMBEDS} parts out of ${chunks.length}.` : undefined;

  return { embeds, content };
}

/**
 * Find current line index based on player position
 */
function findCurrentLine(lines, position) {
  if (!lines || lines.length === 0) return -1;

  // Find the last line whose timestamp is <= current position
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].timestamp <= position) {
      return i;
    }
  }

  return -1; // Before first line
}

/**
 * Build synced lyrics display with highlighted current line
 */
function buildSyncedLyricsEmbed({ lines, currentIndex, trackTitle, provider }) {
  const start = Math.max(0, currentIndex - SYNCED_LINES_BEFORE);
  const end = Math.min(lines.length, currentIndex + SYNCED_LINES_AFTER + 1);

  const visibleLines = [];

  for (let i = start; i < end; i++) {
    const line = lines[i];
    const isCurrent = i === currentIndex;

    // Format: "[MM:SS] Line text" or "▶ [MM:SS] Line text" for current
    const minutes = Math.floor(line.timestamp / 60000);
    const seconds = Math.floor((line.timestamp % 60000) / 1000);
    const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

    const prefix = isCurrent ? "▶ " : "  ";
    const formattedLine = `${prefix}\`[${timeStr}]\` ${line.line || ""}`;

    visibleLines.push(formattedLine);
  }

  const description = visibleLines.join("\n") || "No lyrics at this position";

  const progress = currentIndex >= 0 ? `${currentIndex + 1}/${lines.length}` : `0/${lines.length}`;
  const footer = [provider ? `Provider - ${provider}` : null, `🎵 Live Synced`, progress].filter(Boolean).join(" | ");

  return lyricsEmbed(`Lyrics - ${trackTitle}`, description, footer);
}

/**
 * Active synced lyrics sessions (guildId -> interval)
 */
const activeLyricsSessions = new Map();

/**
 * Build and maintain live synced lyrics display
 */
async function buildSyncedLyricsDisplay({ interaction, player, payload, trackTitle }) {
  const guildId = interaction.guildId;

  // Clear any existing session for this guild
  if (activeLyricsSessions.has(guildId)) {
    clearInterval(activeLyricsSessions.get(guildId));
    activeLyricsSessions.delete(guildId);
  }

  const lines = payload.lines;
  const provider = payload.source || "unknown";

  // Initial display
  const currentPosition = getInterpolatedPosition(player);
  const currentIndex = findCurrentLine(lines, currentPosition);

  const embed = buildSyncedLyricsEmbed({
    lines,
    currentIndex,
    trackTitle,
    provider,
  });

  const message = await interaction.editReply({
    embeds: [embed],
    content: "🎵 **Live Synced Lyrics** - Updates automatically as the song plays",
  });

  // Update loop - fast checking, rate-limited Discord updates
  let lastIndex = currentIndex;
  let lastUpdateTime = Date.now();
  const MIN_UPDATE_DELAY = 800; // Minimum 800ms between Discord API calls

  const updateInterval = setInterval(async () => {
    try {
      const currentPlayer = getPlayer(guildId);

      // Stop if player is gone or track changed
      if (!currentPlayer || currentPlayer.currentTrack?.info?.identifier !== player.currentTrack?.info?.identifier) {
        clearInterval(updateInterval);
        activeLyricsSessions.delete(guildId);
        return;
      }

      // Use interpolated position for accuracy
      const position = getInterpolatedPosition(currentPlayer);
      const newIndex = findCurrentLine(lines, position);

      // Only update Discord if line changed and enough time has passed
      const now = Date.now();
      if (newIndex !== lastIndex && now - lastUpdateTime >= MIN_UPDATE_DELAY) {
        lastIndex = newIndex;
        lastUpdateTime = now;

        const updatedEmbed = buildSyncedLyricsEmbed({
          lines,
          currentIndex: newIndex,
          trackTitle,
          provider,
        });

        await message.edit({
          embeds: [updatedEmbed],
          content: "🎵 **Live Synced Lyrics** - Updates automatically as the song plays",
        });
      }
    } catch (err) {
      // Message deleted or other error - stop updating
      clearInterval(updateInterval);
      activeLyricsSessions.delete(guildId);
    }
  }, UPDATE_INTERVAL);

  activeLyricsSessions.set(guildId, updateInterval);

  // Auto-cleanup after track duration + 10 seconds
  const trackDuration = player.currentTrack?.info?.length || 300000; // Default 5 min
  setTimeout(() => {
    if (activeLyricsSessions.has(guildId)) {
      clearInterval(activeLyricsSessions.get(guildId));
      activeLyricsSessions.delete(guildId);
    }
  }, trackDuration + 10000);
}

module.exports = {
  MAX_EMBED_DESCRIPTION,
  MAX_EMBEDS,
  chunkLyrics,
  buildLyricsResponse,
  buildSyncedLyricsDisplay,
  findCurrentLine,
};
