/**
 * The MewBit mark, derived from the Discord avatar: a cat-ear silhouette
 * wearing headphones, cut by the waveform that runs behind it in the avatar.
 *
 * Drawn rather than traced so it works at 20px in a nav and as a favicon.
 * Monoline, currentColor, with the waveform as the only accented element —
 * the same rule the rest of the surface follows.
 */
export default function Mark({ size = 22, animated = false }) {
  return (
    <svg
      className={animated ? "brandmark is-live" : "brandmark"}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="MewBit"
    >
      {/* ring */}
      <circle cx="16" cy="16" r="13.2" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />

      {/* cat ears */}
      <path
        d="M8.4 11.2 L7.2 5.6 L12.4 8.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23.6 11.2 L24.8 5.6 L19.6 8.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* headphone band and cups */}
      <path
        d="M8.6 18.4 v-2.2 a7.4 7.4 0 0 1 14.8 0 v2.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect x="6.4" y="17.6" width="4.2" height="6.4" rx="2.1" fill="currentColor" />
      <rect x="21.4" y="17.6" width="4.2" height="6.4" rx="2.1" fill="currentColor" />

      {/* the signal it is listening to */}
      <g className="brandmark-wave" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round">
        <path d="M13 19.4 v2.6" />
        <path d="M16 17.4 v6.6" />
        <path d="M19 19.4 v2.6" />
      </g>
    </svg>
  );
}
