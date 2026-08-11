function isAutoplayTrack(track) {
  return Boolean(track?.info?.autoplayed || track?.userData?.autoplay);
}

function markManualTrack(track) {
  if (!track || isAutoplayTrack(track)) return track;

  track.userData = {
    ...(track.userData || {}),
    manual: true,
    autoplay: false,
  };

  return track;
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
};
