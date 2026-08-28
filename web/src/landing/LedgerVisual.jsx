/**
 * One drawn figure per capability group. Each shows the mechanism the rows
 * beside it describe, so the section reads as evidence rather than a table.
 * Achromatic apart from the one mark that carries meaning in each figure.
 */

const LINE = "rgba(255,255,255,0.14)";
const INK = "#8b95a4";
const BRIGHT = "#c3cbd7";
const CYAN = "#67e3f4";
const VIOLET = "#a78bfa";

const FIGURES = {
  /* Four providers converge into one resolved track. */
  Playback: (
    <>
      {["Deezer", "Spotify", "SoundCloud", "YouTube"].map((name, i) => (
        <g key={name}>
          <rect x="2" y={6 + i * 22} width="60" height="16" rx="5" fill="none" stroke={LINE} />
          <text x="10" y={17 + i * 22} fill={INK} fontSize="8" fontFamily="monospace">
            {name.slice(0, 9)}
          </text>
          <path
            d={`M64 ${14 + i * 22} C 84 ${14 + i * 22}, 84 47, 104 47`}
            fill="none"
            stroke={LINE}
          />
        </g>
      ))}
      <rect x="106" y="34" width="52" height="26" rx="7" fill="none" stroke={CYAN} opacity="0.5" />
      <text x="116" y="45" fill={BRIGHT} fontSize="8" fontFamily="monospace">
        one
      </text>
      <text x="116" y="55" fill={CYAN} fontSize="8" fontFamily="monospace">
        FLAC
      </text>
    </>
  ),

  /* The queue empties, autoplay extends it. */
  Selection: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="6" y={8 + i * 20} width="86" height="15" rx="5" fill="none" stroke={LINE} />
          <rect x="11" y={12 + i * 20} width="7" height="7" rx="2" fill={INK} />
          <rect x="23" y={14 + i * 20} width={44 - i * 8} height="3" rx="1.5" fill={INK} />
        </g>
      ))}
      <rect x="6" y="68" width="86" height="15" rx="5" fill="none" stroke={VIOLET} opacity="0.55" strokeDasharray="3 3" />
      <rect x="11" y="72" width="7" height="7" rx="2" fill={VIOLET} opacity="0.7" />
      <rect x="23" y="74" width="30" height="3" rx="1.5" fill={VIOLET} opacity="0.7" />
      <path d="M100 40 l0 26 M96 62 l4 5 4-5" fill="none" stroke={VIOLET} opacity="0.7" />
      <text x="110" y="60" fill={VIOLET} fontSize="8" fontFamily="monospace" opacity="0.9">
        auto
      </text>
    </>
  ),

  /* A curve you shape, behind a gate not everyone passes. */
  Control: (
    <>
      <path
        d="M4 58 C 22 58, 26 22, 44 22 S 68 50, 86 40 S 112 26, 130 30"
        fill="none"
        stroke={BRIGHT}
        strokeWidth="1.6"
      />
      {[
        [16, 50],
        [44, 22],
        [72, 45],
        [100, 33],
        [128, 30],
      ].map(([x, y]) => (
        <g key={x}>
          <line x1={x} y1="14" x2={x} y2="66" stroke={LINE} />
          <circle cx={x} cy={y} r="3" fill={BRIGHT} />
        </g>
      ))}
      <rect x="4" y="72" width="46" height="14" rx="5" fill="none" stroke={CYAN} opacity="0.45" />
      <text x="11" y="82" fill={CYAN} fontSize="8" fontFamily="monospace">
        DJ only
      </text>
      <rect x="56" y="72" width="40" height="14" rx="5" fill="none" stroke={LINE} />
      <text x="63" y="82" fill={INK} fontSize="8" fontFamily="monospace">
        vote
      </text>
    </>
  ),

  /* Three places the same state shows up. */
  Surfaces: (
    <>
      <rect x="4" y="10" width="92" height="58" rx="7" fill="none" stroke={CYAN} opacity="0.45" />
      <line x1="4" y1="24" x2="96" y2="24" stroke={CYAN} opacity="0.3" />
      <circle cx="12" cy="17" r="2" fill={CYAN} opacity="0.6" />
      <rect x="12" y="34" width="24" height="24" rx="4" fill={INK} opacity="0.45" />
      <rect x="44" y="36" width="42" height="4" rx="2" fill={BRIGHT} opacity="0.7" />
      <rect x="44" y="46" width="28" height="3" rx="1.5" fill={INK} />
      <rect x="44" y="55" width="42" height="3" rx="1.5" fill={INK} opacity="0.6" />

      <rect x="104" y="22" width="52" height="20" rx="6" fill="none" stroke={LINE} />
      <rect x="110" y="30" width="30" height="3" rx="1.5" fill={INK} />

      <rect x="104" y="50" width="52" height="30" rx="6" fill="none" stroke={LINE} />
      <line x1="118" y1="50" x2="118" y2="80" stroke={LINE} />
      <rect x="124" y="60" width="24" height="3" rx="1.5" fill={INK} />
      <rect x="124" y="68" width="16" height="3" rx="1.5" fill={INK} opacity="0.6" />
    </>
  ),
};

export default function LedgerVisual({ group }) {
  return (
    <svg className="ledger-fig" viewBox="0 0 162 94" role="presentation" aria-hidden="true">
      {FIGURES[group]}
    </svg>
  );
}
