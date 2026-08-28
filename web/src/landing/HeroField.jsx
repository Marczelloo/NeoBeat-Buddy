/**
 * The hero plate, drawn from the Discord avatar rather than photographed.
 *
 * What survives from the avatar is the part that means something: the
 * symmetric waveform, magenta to the left and cyan to the right, on near-black.
 * The ring went with it at first and has been taken out again — a glowing
 * circle behind a headline is the default move, and it read as one.
 *
 * Everything is deterministic. `wobble` is a fixed-seed hash, not Math.random,
 * so the silhouette is identical on every render and every reload; a hero that
 * reshuffles on refresh is noise, not identity.
 */

import { useEffect, useState } from "react";

const VIEW_W = 1440;
const VIEW_H = 620;
const AXIS = 268;
const BAR_COUNT = 96;
const PITCH = VIEW_W / BAR_COUNT;

/* Deterministic in [0,1). Cheap integer hash — same input, same output. */
function wobble(index) {
  const x = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
}

/* Envelope: loud through the middle, tapering to the edges, the way a rendered
   waveform actually looks. The taper is what stops it reading as a barcode. */
const BARS = Array.from({ length: BAR_COUNT }, (_, index) => {
  const t = index / (BAR_COUNT - 1);
  const fromCentre = Math.abs(t - 0.5) * 2;
  const envelope = Math.cos(fromCentre * 1.35) ** 2;
  const detail = 0.34 + wobble(index) * 0.66;
  const height = 10 + envelope * detail * 236;

  return {
    index,
    x: index * PITCH + PITCH / 2,
    height,
    /* Only the tall middle bars breathe. Sixteen animated nodes, not ninety-six. */
    live: fromCentre < 0.24 && index % 2 === 0,
    delay: `${(wobble(index + 91) * 2.6).toFixed(2)}s`,
    duration: `${(2.8 + wobble(index + 17) * 1.8).toFixed(2)}s`,
  };
});

/* The mask is an SVG attribute, and which one is right depends on whether the
   figure behind the plate is showing. That is a media query, so it is read as
   one rather than guessed from a breakpoint duplicated in JS. */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return narrow;
}

export default function HeroField() {
  const narrow = useNarrow();

  return (
    <svg
      className="herofield"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Magenta into white into cyan — the avatar's own split. The whole
            transition is pulled into the left 60%, because that is all of the
            plate the waveform now occupies. */}
        <linearGradient id="hf-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--live)" />
          <stop offset="20%" stopColor="var(--live)" />
          <stop offset="38%" stopColor="#ffffff" />
          <stop offset="56%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>

        {/* The waveform yields the right of the plate to the figure behind it
            and dies before reaching her. Two motifs crossing in the one region
            where both carry detail is how a composition turns to noise; each
            gets its own territory instead. The left edge fades so the plate has
            no edge to notice. */}
        <linearGradient id="hf-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="13%" stopColor="#fff" />
          <stop offset="34%" stopColor="#fff" />
          <stop offset="58%" stopColor="#000" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id="hf-mask">
          <rect width={VIEW_W} height={VIEW_H} fill="url(#hf-fade)" />
        </mask>

        {/* Below 860px the figure is gone, so there is nothing to yield to and
            the waveform takes the whole plate back. */}
        <linearGradient id="hf-fade-wide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="14%" stopColor="#fff" />
          <stop offset="86%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id="hf-mask-wide">
          <rect width={VIEW_W} height={VIEW_H} fill="url(#hf-fade-wide)" />
        </mask>

        <linearGradient id="hf-head" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.16" />
        </linearGradient>

        {/* The plate is dissolved by painting the page ground back over it in a
            ramp, rather than by masking. Same result, and it keeps the opening
            copy sitting on a surface that only gets darker behind it. */}
        <linearGradient id="hf-veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bg)" stopOpacity="0.2" />
          <stop offset="46%" stopColor="var(--bg)" stopOpacity="0.46" />
          <stop offset="100%" stopColor="var(--bg)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <g mask={narrow ? "url(#hf-mask-wide)" : "url(#hf-mask)"}>
        <g className="hf-wave" opacity="0.45">
          {BARS.map((bar) => (
            <rect
              key={bar.index}
              className={bar.live ? "hf-bar is-live" : "hf-bar"}
              x={bar.x - 1.1}
              y={AXIS - bar.height / 2}
              width="2.2"
              height={bar.height}
              rx="1.1"
              fill="url(#hf-wave)"
              style={bar.live ? { animationDelay: bar.delay, animationDuration: bar.duration } : undefined}
            />
          ))}
        </g>

        {/* The playhead. One animated node standing in for "this is running". */}
        <rect className="hf-head" x="0" y="0" width="190" height={VIEW_H} fill="url(#hf-head)" />
      </g>

      <rect width={VIEW_W} height={VIEW_H} fill="url(#hf-veil)" />
    </svg>
  );
}
