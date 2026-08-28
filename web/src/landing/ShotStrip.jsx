import { useEffect, useState } from "react";

/**
 * Real screenshots of the Activity, dropped into public/shots.
 *
 * Each frame removes itself if its file is missing, and the whole strip stays
 * out of the document until at least the first one exists — so the page is
 * correct before the assets land and upgrades the moment they do, with no
 * code change.
 */
const SHOTS = [
  { file: "search.png", title: "Search", caption: "Every provider answers, and each result keeps the source it resolved from." },
  { file: "lyrics.png", title: "Lyrics", caption: "Synced line by line, with a per-user timing offset when a source runs early." },
  { file: "filters.png", title: "Effects", caption: "Thirteen one-click Lavalink filters, applied to the live player." },
  { file: "equalizer.png", title: "Equalizer", caption: "Fifteen bands, twenty-two presets, and custom presets saved per user." },
  { file: "embed.png", title: "Text channel", caption: "The message embed stays as a fallback, with the full transport on it." },
];

function Shot({ shot }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className="shot">
      <img
        src={`/shots/${shot.file}`}
        alt={`MewBit — ${shot.title}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <figcaption>
        <b>{shot.title}</b>
        <span>{shot.caption}</span>
      </figcaption>
    </figure>
  );
}

export default function ShotStrip() {
  const [present, setPresent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => !cancelled && setPresent(true);
    probe.src = `/shots/${SHOTS[0].file}`;
    return () => {
      cancelled = true;
      probe.onload = null;
    };
  }, []);

  if (!present) return null;

  return (
    <div className="shots">
      {SHOTS.map((shot) => (
        <Shot key={shot.file} shot={shot} />
      ))}
    </div>
  );
}
