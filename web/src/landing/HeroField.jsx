/**
 * The hero plate, drawn from the Discord avatar rather than photographed.
 *
 * The avatar's composition is three things: a thin neon ring, a symmetric
 * waveform running through its centre, and near-black behind both. That is
 * what this draws — the same geometry at page scale, so the opening reads as
 * the brand instead of as stock atmosphere.
 *
 * Everything is deterministic. `wobble` is a fixed-seed hash, not Math.random,
 * so the silhouette is identical on every render and every reload; a hero that
 * reshuffles on refresh is noise, not identity.
 */

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

const SPARKS = Array.from({ length: 14 }, (_, index) => {
  const angle = wobble(index + 200) * Math.PI * 2;
  const radius = 268 + wobble(index + 300) * 132;
  return {
    cx: VIEW_W / 2 + Math.cos(angle) * radius * 1.9,
    cy: AXIS + Math.sin(angle) * radius * 0.62,
    r: 0.9 + wobble(index + 400) * 1.5,
    o: 0.1 + wobble(index + 500) * 0.26,
  };
});

export default function HeroField() {
  return (
    <svg
      className="herofield"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Magenta on the left, cyan on the right, white through the middle —
            the avatar's own split, carried at hairline weight. */}
        <linearGradient id="hf-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--live)" />
          <stop offset="34%" stopColor="var(--live)" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="66%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>

        <linearGradient id="hf-ring" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--live)" />
          <stop offset="52%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>

        {/* Ends fade to nothing so the plate has no edge to notice. */}
        <linearGradient id="hf-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="14%" stopColor="#fff" />
          <stop offset="86%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id="hf-mask">
          <rect width={VIEW_W} height={VIEW_H} fill="url(#hf-fade)" />
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

      <g mask="url(#hf-mask)">
        <g className="hf-rings">
          <ellipse
            cx={VIEW_W / 2}
            cy={AXIS}
            rx="470"
            ry="272"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity="0.05"
          />
          <ellipse
            className="hf-ring-lit"
            cx={VIEW_W / 2}
            cy={AXIS}
            rx="352"
            ry="204"
            fill="none"
            stroke="url(#hf-ring)"
            strokeWidth="1.25"
            opacity="0.3"
          />
          <ellipse
            className="hf-ring-ticks"
            cx={VIEW_W / 2}
            cy={AXIS}
            rx="352"
            ry="204"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity="0.05"
            strokeDasharray="2 10"
          />
        </g>

        <g className="hf-sparks">
          {SPARKS.map((spark, index) => (
            <circle
              key={index}
              cx={spark.cx}
              cy={spark.cy}
              r={spark.r}
              fill="#ffffff"
              opacity={spark.o}
            />
          ))}
        </g>

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
        <rect className="hf-head" x="0" y={AXIS - 150} width="150" height="300" fill="url(#hf-head)" />
      </g>

      <rect width={VIEW_W} height={VIEW_H} fill="url(#hf-veil)" />
    </svg>
  );
}
