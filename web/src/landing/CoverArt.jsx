/**
 * Authored cover art for the example session. Drawn SVG rather than a
 * gradient tile with a letter on it — this artwork is the evidence the
 * palette's whole argument rests on, so it is made, not suggested.
 *
 * Achromatic by rule: colour on this surface carries meaning, and example
 * artwork means nothing.
 */

const COVERS = {
  // Concentric shells — a creature kept in a box.
  tamagotchi: (
    <>
      <rect x="0" y="0" width="48" height="48" fill="#0e1116" />
      <rect x="9" y="7" width="30" height="34" rx="12" stroke="#8b95a4" strokeWidth="1.5" fill="none" />
      <rect x="14" y="13" width="20" height="16" rx="6" fill="#c3cbd7" />
      <circle cx="20" cy="21" r="1.6" fill="#0e1116" />
      <circle cx="28" cy="21" r="1.6" fill="#0e1116" />
      <circle cx="17" cy="35" r="2" fill="#5c6675" />
      <circle cx="24" cy="35" r="2" fill="#5c6675" />
      <circle cx="31" cy="35" r="2" fill="#5c6675" />
    </>
  ),

  // A road running to a low horizon.
  nightdrive: (
    <>
      <rect x="0" y="0" width="48" height="48" fill="#0b0e13" />
      <circle cx="24" cy="21" r="10" fill="#454e5c" />
      <rect x="12" y="19" width="24" height="1.6" fill="#0b0e13" />
      <rect x="12" y="23" width="24" height="2" fill="#0b0e13" />
      <rect x="12" y="27.5" width="24" height="2.4" fill="#0b0e13" />
      <path d="M0 33h48" stroke="#6b7585" strokeWidth="1" />
      <path d="M24 33 L10 48" stroke="#8b95a4" strokeWidth="1.2" />
      <path d="M24 33 L38 48" stroke="#8b95a4" strokeWidth="1.2" />
      <path d="M24 37v3M24 43v5" stroke="#c3cbd7" strokeWidth="1.4" />
    </>
  ),

  // Signal decaying into noise.
  signallost: (
    <>
      <rect x="0" y="0" width="48" height="48" fill="#101319" />
      <path
        d="M2 24h5l3-9 3 18 3-13 3 8 3-4 3 6 3-11 3 7 3-3h9"
        stroke="#c3cbd7"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <rect x="30" y="14" width="1.5" height="20" fill="#5c6675" />
      <rect x="34" y="18" width="1.5" height="12" fill="#454e5c" />
      <rect x="38" y="21" width="1.5" height="6" fill="#39414d" />
    </>
  ),
};

export default function CoverArt({ art, title }) {
  return (
    <svg className="qart" viewBox="0 0 48 48" role="img" aria-label={`${title} — example artwork`}>
      {COVERS[art]}
    </svg>
  );
}
