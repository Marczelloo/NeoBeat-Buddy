const PROVIDER_HOSTS = [
  { source: "youtube", hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"] },
  { source: "soundcloud", hosts: ["soundcloud.com", "snd.sc", "soundcloud.app.goo.gl"] },
  { source: "spotify", hosts: ["spotify.com", "spotify.link"] },
  { source: "deezer", hosts: ["deezer.com", "deezer.page.link"] },
];

function hostMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Keeps a pasted playable URL out of provider search. Lavalink can resolve the
 * original URL directly, which avoids replacing it with a similarly named
 * search result from another provider.
 */
export function parseMusicLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return null;

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const provider = PROVIDER_HOSTS.find(({ hosts }) => hosts.some((domain) => hostMatches(hostname, domain)));

    return {
      url: url.toString(),
      source: provider?.source || "direct",
      hostname,
    };
  } catch {
    return null;
  }
}
