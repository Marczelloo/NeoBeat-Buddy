/**
 * A section break drawn in the hero's own vocabulary — the same waveform, seen
 * from far enough away that it is nearly a rule. It stitches the lower page
 * together without introducing a second visual language.
 *
 * Deterministic, like HeroField: same seed, same silhouette, every render.
 */

const W = 1200;
const H = 34;
const COUNT = 150;
const PITCH = W / COUNT;

function wobble(index, seed) {
  const x = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return x - Math.floor(x);
}

function build(seed) {
  return Array.from({ length: COUNT }, (_, index) => {
    const t = index / (COUNT - 1);
    /* Two slow swells across the width, so the rule has a shape instead of
       being an even comb. */
    const swell = 0.34 + 0.66 * Math.abs(Math.sin(t * Math.PI * 1.5 + seed));
    return {
      index,
      x: index * PITCH,
      height: 2 + swell * wobble(index, seed) * 26,
    };
  });
}

const FIELDS = {
  a: build(4.1414),
  b: build(1.7321),
  c: build(2.6458),
};

export default function SectionRule({ seed = "a" }) {
  const bars = FIELDS[seed] || FIELDS.a;

  return (
    <svg
      className="secrule"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`sr-ink-${seed}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--live)" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id={`sr-fade-${seed}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="22%" stopColor="#fff" />
          <stop offset="78%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id={`sr-mask-${seed}`}>
          <rect width={W} height={H} fill={`url(#sr-fade-${seed})`} />
        </mask>
      </defs>

      <g mask={`url(#sr-mask-${seed})`} opacity="0.32">
        {bars.map((bar) => (
          <rect
            key={bar.index}
            x={bar.x}
            y={(H - bar.height) / 2}
            width="1"
            height={bar.height}
            fill={`url(#sr-ink-${seed})`}
          />
        ))}
      </g>
    </svg>
  );
}
