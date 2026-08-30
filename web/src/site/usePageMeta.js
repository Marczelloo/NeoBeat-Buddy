import { useEffect } from "react";

const SUFFIX = "MewBit";
const DEFAULT_DESCRIPTION =
  "MewBit is a self-hosted Discord music bot with multi-source search, FLAC playback, DJ mode, an equalizer, synced lyrics and playlists. Deploy your own.";

function setMeta(selector, attribute, value) {
  const tag = document.head.querySelector(selector);
  if (tag) tag.setAttribute(attribute, value);
}

/**
 * Gives each route its own title and description.
 *
 * A single-page app keeps whatever the shell was served with, so every page
 * here was announced as the landing page — in the browser tab, in a bookmark,
 * in a screen reader's page title, and in the card Discord unfurls when someone
 * pastes the link. The canonical URL moves too, so the reference pages are not
 * all claiming to be the home page.
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const full = title ? `${title} — ${SUFFIX}` : `${SUFFIX} — self-hosted Discord music`;
    const text = description || DEFAULT_DESCRIPTION;

    document.title = full;
    setMeta('meta[name="description"]', "content", text);
    setMeta('meta[property="og:title"]', "content", full);
    setMeta('meta[property="og:description"]', "content", text);
    setMeta('meta[name="twitter:title"]', "content", full);
    setMeta('meta[name="twitter:description"]', "content", text);
    setMeta('meta[property="og:url"]', "content", window.location.href);
    setMeta('link[rel="canonical"]', "href", window.location.origin + window.location.pathname);
  }, [title, description]);
}
