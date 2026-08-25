const { URL } = require("node:url");

const TRUSTED_MEDIA_HOSTS = Object.freeze([
  "youtube.com", "youtu.be", "youtube-nocookie.com", "soundcloud.com", "snd.sc",
  "spotify.com", "spotify.link", "deezer.com", "deezer.page.link", "bandcamp.com",
  "twitch.tv", "vimeo.com",
]);

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function getConfiguredHosts() {
  return String(process.env.ALLOWED_DIRECT_MEDIA_HOSTS || "")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
}

function hostMatches(hostname, allowedHost) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function isAllowedMusicUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return [...TRUSTED_MEDIA_HOSTS, ...getConfiguredHosts()].some((host) => hostMatches(hostname, host));
  } catch {
    return false;
  }
}

function assertAllowedMusicUrl(value) {
  if (!isHttpUrl(value) || isAllowedMusicUrl(value)) return;
  throw Object.assign(
    new Error("That media URL is not allowed. Use a supported provider or configure ALLOWED_DIRECT_MEDIA_HOSTS."),
    { statusCode: 400 },
  );
}

module.exports = { assertAllowedMusicUrl, isAllowedMusicUrl, isHttpUrl };
