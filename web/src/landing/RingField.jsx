/**
 * The hero's ring, again, at the far end of the page. Two hairline ellipses and
 * a tick track — the same geometry, so the top and the bottom of the document
 * are held by the same shape instead of the lower half running out of ideas.
 *
 * Decorative only, and drawn: nothing here is an image file.
 */
export default function RingField() {
  return (
    <svg
      className="ringfield"
      viewBox="0 0 900 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="rf-ink" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--auto)" />
          <stop offset="55%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <radialGradient id="rf-fade" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="62%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <mask id="rf-mask">
          <rect width="900" height="520" fill="url(#rf-fade)" />
        </mask>
      </defs>

      <g mask="url(#rf-mask)" fill="none">
        <ellipse cx="450" cy="260" rx="392" ry="228" stroke="url(#rf-ink)" strokeWidth="1" opacity="0.26" />
        <ellipse cx="450" cy="260" rx="392" ry="228" stroke="#ffffff" strokeWidth="1" opacity="0.05" strokeDasharray="1 9" />
        <ellipse cx="450" cy="260" rx="286" ry="166" stroke="#ffffff" strokeWidth="1" opacity="0.04" />
      </g>
    </svg>
  );
}
