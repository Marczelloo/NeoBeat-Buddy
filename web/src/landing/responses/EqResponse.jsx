/* Band frequencies match the ten preset bands in helpers/lavalink/constants.js. */
const BANDS = [
  { hz: "25", db: 4 },
  { hz: "40", db: 3.5 },
  { hz: "63", db: 3 },
  { hz: "100", db: 1.5 },
  { hz: "160", db: 0 },
  { hz: "250", db: -1 },
  { hz: "400", db: -1.5 },
  { hz: "630", db: 0 },
  { hz: "1k", db: 1.5 },
  { hz: "1.6k", db: 2.5 },
];

const RANGE = 5;

export default function EqResponse() {
  return (
    <div>
      <p className="resp-lead">
        Twenty-two presets across the ten equalizer bands, custom presets saved per user, and filter
        presets that stack on top.
      </p>

      <div className="eq">
        {BANDS.map((band) => {
          const height = ((band.db + RANGE) / (RANGE * 2)) * 100;
          return (
            <div className="eq-band" key={band.hz}>
              <span className="mono eq-db">{band.db > 0 ? `+${band.db}` : band.db}</span>
              <div className="eq-track">
                <span className="eq-fill" style={{ height: `${height}%` }} />
                <span className="eq-zero" />
              </div>
              <span className="mono eq-hz">{band.hz}</span>
            </div>
          );
        })}
      </div>

      <div className="eq-presets">
        <span className="mode is-on">bassboost</span>
        <span className="mode">flat</span>
        <span className="mode">vocal</span>
        <span className="mode">nightcore</span>
        <span className="mode">lofi</span>
        <span className="eq-more mono">+17 more</span>
      </div>
    </div>
  );
}
