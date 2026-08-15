function isAutoplayTrack(track) {
  return Boolean(track?.info?.autoplayed || track?.userData?.autoplay);
}

function markManualTrack(track) {
  if (!track) return track;

  // A track can be deliberately pulled out of the autoplay buffer (for
  // example through "Play next"). Clear both markers: Poru preserves
  // info.autoplayed across clones, so changing only userData is not enough.
  track.info = {
    ...(track.info || {}),
    autoplayed: false,
  };
  track.userData = {
    ...(track.userData || {}),
    manual: true,
    autoplay: false,
  };

  return track;
}

function partitionQueueTracks(tracks = []) {
  const manual = [];
  const autoplay = [];

  for (const track of tracks) {
    if (!track) continue;
    (isAutoplayTrack(track) ? autoplay : manual).push(track);
  }

  return { manual, autoplay, tracks: [...manual, ...autoplay] };
}

function normalizeQueueAutoplayPartition(queue) {
  if (!queue?.splice) return [];
  const current = Array.from(queue);
  const ordered = partitionQueueTracks(current).tracks;
  const unchanged = ordered.length === current.length && ordered.every((track, index) => track === current[index]);
  if (!unchanged) queue.splice(0, queue.length, ...ordered);
  return ordered;
}

/**
 * Reorders a track within its origin segment. Manual and autoplay tracks are
 * intentionally never interleaved: this keeps the autoplay buffer explicit
 * after drag-and-drop, undo restoration, and any legacy mixed queue.
 */
function moveQueueTrackWithinOrigin(queue, from, to) {
  const tracks = normalizeQueueAutoplayPartition(queue);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= tracks.length || to >= tracks.length) {
    return false;
  }

  const moving = tracks[from];
  const movingAutoplay = isAutoplayTrack(moving);
  const segment = tracks.filter((track) => isAutoplayTrack(track) === movingAutoplay);
  const sourceIndex = segment.indexOf(moving);
  const targetTrack = tracks[to];
  const targetAutoplay = isAutoplayTrack(targetTrack);
  const crossesDivider = targetAutoplay !== movingAutoplay;

  // Crossing the divider clamps to the nearest edge of the originating
  // segment, instead of silently turning an autoplay reservation into a
  // manual request (or the other way around).
  let targetIndex;
  if (crossesDivider) {
    targetIndex = movingAutoplay ? 0 : segment.length;
  } else {
    targetIndex = segment.indexOf(targetTrack);
  }

  segment.splice(sourceIndex, 1);
  if (!crossesDivider && sourceIndex < targetIndex) targetIndex -= 1;
  segment.splice(Math.max(0, Math.min(segment.length, targetIndex)), 0, moving);

  const partition = partitionQueueTracks(tracks);
  const next = movingAutoplay ? [...partition.manual, ...segment] : [...segment, ...partition.autoplay];
  queue.splice(0, queue.length, ...next);
  return true;
}

/**
 * Adds manually requested tracks before the autoplay buffer while preserving
 * the order of both the manual tracks and the existing autoplay tracks.
 */
function addManualTracksToQueue(player, tracks) {
  if (!player?.queue || !Array.isArray(tracks) || tracks.length === 0) return 0;

  const validTracks = tracks.filter(Boolean).map(markManualTrack);
  if (validTracks.length === 0) return 0;

  const autoplayIndex = player.queue.findIndex(isAutoplayTrack);

  if (autoplayIndex === -1) {
    player.queue.push(...validTracks);
  } else {
    player.queue.splice(autoplayIndex, 0, ...validTracks);
  }

  return validTracks.length;
}

module.exports = {
  addManualTracksToQueue,
  isAutoplayTrack,
  markManualTrack,
  moveQueueTrackWithinOrigin,
  normalizeQueueAutoplayPartition,
  partitionQueueTracks,
};
