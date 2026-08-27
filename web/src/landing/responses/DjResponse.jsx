const VOTERS = ["Neko", "juno", "wisp", "orla", "kade"];
const VOTED = 3;

export default function DjResponse() {
  return (
    <div>
      <p className="resp-lead">
        DJ mode gates the destructive controls behind a role, a vote, or both. Skipping stays
        possible without an argument.
      </p>

      <div className="vote">
        <div className="vote-head">
          <b>Skip “Tamagotchi”?</b>
          <span className="mono vote-count">
            {VOTED} / {VOTERS.length}
          </span>
        </div>

        <div className="vote-bar" role="img" aria-label={`${VOTED} of ${VOTERS.length} votes cast`}>
          <span style={{ width: `${(VOTED / VOTERS.length) * 100}%` }} />
          <em style={{ left: "50%" }} />
        </div>

        <div className="vote-legend">
          <span className="mono">threshold 50%</span>
          <span className="mono">passes at 3</span>
        </div>

        <div className="vote-people">
          {VOTERS.map((name, index) => (
            <span key={name} className={index < VOTED ? "chip is-voted" : "chip"}>
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="dj-modes">
        <span className="mode is-on">Hybrid</span>
        <span className="mode">DJ only</span>
        <span className="mode">Vote</span>
        <span className="dj-role">DJ role · @Selector</span>
      </div>
    </div>
  );
}
