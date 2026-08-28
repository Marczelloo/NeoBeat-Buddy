import { useState } from "react";
import "./activity.css";

/**
 * The Activity, shown as it actually renders. These are screenshots of the
 * running surface rather than a reconstruction — the page argues by showing
 * the product. Every frame removes itself if its file is missing, so the
 * section stays correct when an asset has not been captured yet.
 */
const LEAD = {
  file: "player.png",
  alt: "The MewBit Activity: library, now playing, transport and the shared queue",
};

const PANELS = [
  {
    file: "search.png",
    title: "Search",
    caption: "Every provider answers at once, and each result keeps the source it resolved from.",
  },
  {
    file: "lyrics.png",
    title: "Lyrics",
    caption: "Synced line by line, with a per-user timing offset when a source runs early.",
  },
  {
    file: "filters.png",
    title: "Effects",
    caption: "Thirteen one-click Lavalink filters, applied to the live player.",
  },
  {
    file: "equalizer.png",
    title: "Equalizer",
    caption: "Fifteen bands from 25 Hz to 16 kHz, with presets saved per user.",
  },
];

const FALLBACKS = [
  {
    file: "embed.png",
    title: "The text channel still works",
    caption:
      "Not everyone opens the Activity. The message embed carries the same transport, the same provenance and the same state.",
  },
  {
    file: "voicechannel.png",
    title: "The channel says what is on",
    caption: "The voice channel status names the current track, so people know before they join.",
    small: true,
  },
];

function Frame({ shot, className }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className={className}>
      <span className={shot.small ? "shot-pad is-small" : "shot-pad"}>
        <img
          src={`/shots/${shot.file}`}
          alt={shot.alt || `MewBit — ${shot.title}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
      {shot.title ? (
        <figcaption>
          <b>{shot.title}</b>
          <span>{shot.caption}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}

export default function ActivityShowcase() {
  const [leadFailed, setLeadFailed] = useState(false);

  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <div className="showcase-head">
        <h2 id="showcase-heading">The player lives inside Discord.</h2>
        <p>
          MewBit ships a Discord Activity: a shared cockpit that opens in the voice channel, so
          everyone works from the same queue, the same artwork and the same controls.
        </p>
      </div>

      {leadFailed ? null : (
        <figure className="shot-lead">
          <img
            src={`/shots/${LEAD.file}`}
            alt={LEAD.alt}
            loading="lazy"
            decoding="async"
            onError={() => setLeadFailed(true)}
          />
        </figure>
      )}

      <div className="shots">
        {PANELS.map((shot) => (
          <Frame key={shot.file} shot={shot} className="shot" />
        ))}
      </div>

      <div className="shots is-pair">
        {FALLBACKS.map((shot) => (
          <Frame key={shot.file} shot={shot} className="shot" />
        ))}
      </div>

      <p className="stage-note">
        Screenshots of a running instance. Cover artwork belongs to its rights holders.
      </p>
    </section>
  );
}
