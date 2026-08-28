import { useEffect, useMemo, useRef } from "react";

/**
 * A section break drawn in the hero's own vocabulary — the same waveform, seen
 * from far enough away that it is nearly a rule.
 *
 * The pointer drops into it. Each drop sends a wave packet outward in both
 * directions along the rule, travelling and decaying, with a trough behind the
 * crest — a cross-section of a stone hitting water, which is what a row of bars
 * is a cross-section of anyway.
 *
 * The whole rule is ONE path, and a frame is one `d` rewrite. Bar heights are
 * real geometry here: an earlier version faked the swell with a CSS radial mask
 * over a scaled copy, which glitched on every recomposite and never actually
 * moved. Nothing is masked now — the end fade is alpha in the stroke gradient.
 *
 * The resting silhouette is deterministic, like HeroField: same seed, same
 * shape, every render.
 */

const W = 1200;
const H = 34;
const COUNT = 150;
const PITCH = W / COUNT;

/* Wave packet: LIFE seconds long, the crest travelling at SPEED viewBox units
   per second, SIGMA wide, peaking at AMP units of displacement. */
const LIFE = 1.75;
const SPEED = 640;
const SIGMA = 82;
const AMP = 21;
const MAX_DROPS = 5;

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

function trace(bars, drops, now) {
  let d = "";

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    let lift = 0;

    for (let j = 0; j < drops.length; j += 1) {
      const drop = drops[j];
      const age = (now - drop.t) / 1000;
      if (age < 0 || age > LIFE) continue;

      const offset = Math.abs(bar.x - drop.x) - SPEED * age;
      const packet = Math.exp(-(offset * offset) / (2 * SIGMA * SIGMA));
      if (packet < 0.004) continue;

      // Decays with age, and the cosine puts a trough behind the crest.
      const decay = Math.exp(-age * 1.7) * (1 - age / LIFE);
      lift += AMP * drop.gain * decay * packet * Math.cos((offset / SIGMA) * 2.1);
    }

    const height = Math.max(1.4, bar.height + lift);
    const top = (H - height) / 2;
    d += `M${bar.x.toFixed(1)} ${top.toFixed(1)}V${(top + height).toFixed(1)}`;
  }

  return d;
}

export default function SectionRule({ seed = "a" }) {
  const bars = FIELDS[seed] || FIELDS.a;
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const dropsRef = useRef([]);
  const frameRef = useRef(0);
  const lastRef = useRef({ x: -Infinity, t: 0 });

  const resting = useMemo(() => trace(bars, [], 0), [bars]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function run() {
    if (frameRef.current) return;

    const step = () => {
      const now = performance.now();
      dropsRef.current = dropsRef.current.filter((drop) => now - drop.t < LIFE * 1000);

      if (dropsRef.current.length === 0) {
        frameRef.current = 0;
        pathRef.current?.setAttribute("d", resting);
        return;
      }

      pathRef.current?.setAttribute("d", trace(bars, dropsRef.current, now));
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  }

  function addDrop(event, gain) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const svg = svgRef.current;
    if (!svg) return;

    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    const now = performance.now();
    const last = lastRef.current;

    // Moving the pointer should not spray drops; it should leave a trail.
    if (gain < 1 && Math.abs(x - last.x) < 110 && now - last.t < 300) return;
    lastRef.current = { x, t: now };

    dropsRef.current.push({ x, t: now, gain });
    if (dropsRef.current.length > MAX_DROPS) dropsRef.current.shift();
    run();
  }

  return (
    <svg
      ref={svgRef}
      className="secrule"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      onPointerEnter={(event) => addDrop(event, 1)}
      onPointerMove={(event) => addDrop(event, 0.62)}
    >
      <defs>
        {/* Magenta into white into cyan, with the ends carried to zero alpha.
            The fade is in the gradient, so the rule needs no mask at all. */}
        <linearGradient id={`sr-ink-${seed}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--live)" stopOpacity="0" />
          <stop offset="20%" stopColor="var(--live)" stopOpacity="1" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="80%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        ref={pathRef}
        d={resting}
        fill="none"
        stroke={`url(#sr-ink-${seed})`}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.38"
      />
    </svg>
  );
}
