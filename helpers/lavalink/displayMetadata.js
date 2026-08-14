function getDisplayTrackMetadata(track) {
  const info = track?.info || track || {};
  const reference = track?.userData?.autoplayReference || {};

  return {
    title: String(reference.title || info.title || "Unknown track"),
    author: String(reference.artist || info.author || "Unknown artist"),
  };
}

module.exports = { getDisplayTrackMetadata };
