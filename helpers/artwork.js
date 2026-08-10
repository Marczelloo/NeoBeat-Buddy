function getHighResolutionArtworkUrl(value) {
  const original = String(value || "").trim();
  if (!/^https?:\/\//i.test(original)) return original || null;

  try {
    const url = new URL(original);
    const host = url.hostname.toLowerCase();

    if (host === "dzcdn.net" || host.endsWith(".dzcdn.net")) {
      // Deezer exposes the requested dimensions in the path. 1000 px gives
      // the Activity enough density for large covers and high-DPI displays.
      url.pathname = url.pathname.replace(
        /\/\d+x\d+(?=(?:-\d+){3,}\.(?:jpe?g|png|webp)$)/i,
        "/1000x1000"
      );
    } else if (host === "sndcdn.com" || host.endsWith(".sndcdn.com")) {
      // t500x500 is SoundCloud's largest broadly available artwork rendition.
      url.pathname = url.pathname.replace(
        /-(?:tiny|badge|small|large|t300x300)(?=\.(?:jpe?g|png|webp)$)/i,
        "-t500x500"
      );
    } else if (host === "i.scdn.co" || host.endsWith(".scdn.co") || host.endsWith(".spotifycdn.com")) {
      // Spotify's image CDN encodes rendition size in this token.
      url.pathname = url.pathname.replace(/ab67616d0000(?:1e02|04851)/i, "ab67616d0000b273");
    } else if (host === "i.ytimg.com" || host.endsWith(".ytimg.com") || host === "img.youtube.com") {
      // maxresdefault is not available for every upload, so callers retain
      // the original URL as an automatic fallback.
      url.pathname = url.pathname.replace(
        /\/(?:default|mqdefault|hqdefault|sddefault|hq720|0)\.(jpe?g|webp)$/i,
        "/maxresdefault.$1"
      );
    }

    return url.toString();
  } catch {
    return original;
  }
}

function getArtworkUrls(value) {
  const fallback = String(value || "").trim() || null;
  const primary = getHighResolutionArtworkUrl(fallback);
  return {
    primary: primary || fallback,
    fallback: primary && fallback && primary !== fallback ? fallback : null,
  };
}

function getTrackArtworkSource(track) {
  const info = track?.info || track || {};
  const direct = info.artworkUrl || info.thumbnail || info.image || track?.artworkUrl || track?.thumbnail;
  if (direct) return direct;

  const source = String(info.sourceName || info.source || track?.source || "").toLowerCase();
  const identifier = String(info.identifier || track?.identifier || "").trim();
  const uri = String(info.uri || track?.uri || "");

  if (source.includes("youtube") || source === "ytsearch" || source === "ytmsearch") {
    const videoId = identifier.match(/^[A-Za-z0-9_-]{11}$/)?.[0] ||
      uri.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] ||
      uri.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)?.[1];
    if (videoId) return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  return null;
}

module.exports = {
  getArtworkUrls,
  getHighResolutionArtworkUrl,
  getTrackArtworkSource,
};
