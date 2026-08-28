import { useState } from "react";
import "./activity.css";

/**
 * The Activity, shown as it actually renders — screenshots of the running
 * surface, not a reconstruction.
 *
 * Laid out as an exhibit rather than a tile grid: the spans are deliberately
 * uneven, the lead carries the channel status overlapping its own corner the
 * way the product does, and the closing frame turns to prose. A gallery where
 * every cell is the same size tells you every frame matters the same amount,
 * which is never true.
 *
 * Each frame removes itself if its file is missing, so the section stays
 * correct when an asset has not been captured yet.
 */

const LEAD = {
  file: "player.png",
  index: "01",
  title: "The player",
  tag: "activity",
  alt: "The MewBit Activity: library, now playing, transport and the shared queue",
  caption:
    "One cockpit in the voice channel. Everyone works from the same queue, the same artwork and the same transport — there is no host who sees more than the rest.",
};

const INSET = {
  file: "voicechannel.png",
  alt: "The Discord voice channel status naming the current track",
};

const PANELS = [
  {
    file: "search.png",
    index: "02",
    title: "Search",
    tag: "activity",
    span: "is-wide",
    caption: "Every provider answers at once, and each result keeps the source it resolved from.",
  },
  {
    file: "lyrics.png",
    index: "03",
    title: "Lyrics",
    tag: "activity",
    span: "is-narrow",
    caption: "Synced line by line, with a per-user timing offset when a source runs early.",
    detail: "Deezer → LRC Library → Genius",
  },
  {
    file: "filters.png",
    index: "04",
    title: "Effects",
    tag: "activity",
    span: "is-narrow",
    caption: "Thirteen one-click Lavalink filters, applied to the live player.",
    detail: "stacks on top of the equalizer",
  },
  {
    file: "equalizer.png",
    index: "05",
    title: "Equalizer",
    tag: "activity",
    span: "is-wide",
    caption: "Fifteen bands from 25 Hz to 16 kHz, with presets saved per user.",
  },
];

const EMBED = {
  file: "embed.png",
  index: "06",
  title: "The message embed",
  tag: "text channel",
  small: true,
};

function Plate({ shot }) {
  return (
    <div className="plate">
      <span className="mono plate-no">{shot.index}</span>
      <b>{shot.title}</b>
      <span className="mono plate-tag">{shot.tag}</span>
    </div>
  );
}

function Frame({ shot, className, children }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className={className}>
      <Plate shot={shot} />
      {/* The media is its own positioning context, so anything layered over it
          lands on the capture and never over the caption text. */}
      <span className="shot-media">
        <span className={shot.small ? "shot-pad is-small" : "shot-pad"}>
          <img
            src={`/shots/${shot.file}`}
            alt={shot.alt || `MewBit — ${shot.title}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </span>
        {children}
      </span>
      {shot.caption ? (
        <figcaption>
          {shot.caption}
          {shot.detail ? <span className="mono plate-detail">{shot.detail}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Inset() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className="ex-inset">
      <img src={`/shots/${INSET.file}`} alt={INSET.alt} loading="lazy" onError={() => setFailed(true)} />
      <figcaption className="mono">the channel says what is on</figcaption>
    </figure>
  );
}

export default function ActivityShowcase() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <div className="showcase-head">
        <h2 id="showcase-heading">The player lives inside Discord.</h2>
        <p>
          MewBit ships a Discord Activity: a shared cockpit that opens in the voice channel, so
          everyone works from the same queue, the same artwork and the same controls.
        </p>
      </div>

      <div className="exhibit">
        <Frame shot={LEAD} className="ex-lead">
          <Inset />
        </Frame>

        {PANELS.map((shot) => (
          <Frame key={shot.file} shot={shot} className={`ex-panel ${shot.span}`} />
        ))}

        <div className="ex-close">
          <div className="ex-close-text">
            <h3>Not everyone opens the Activity.</h3>
            <p>
              The message embed carries the same transport, the same provenance and the same state.
              Nothing about the bot depends on the visual surface being open — it is the better view,
              not the only one.
            </p>
            <p className="mono ex-close-note">Same queue · same filters · same DJ rules.</p>
          </div>
          <Frame shot={EMBED} className="ex-embed" />
        </div>
      </div>

      <p className="stage-note">
        Screenshots of a running instance. Cover artwork belongs to its rights holders.
      </p>
    </section>
  );
}
