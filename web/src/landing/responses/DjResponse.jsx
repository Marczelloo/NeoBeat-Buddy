import { useState } from "react";

/* Every fact below is read off helpers/dj/store.js and helpers/dj/skipVotes.js:
   the three skip modes, the 10-100% threshold, ceil(eligible x threshold) with
   a floor of one, the five-minute vote expiry, and the permission ladder in
   hasDjPermissions(). Nothing here is invented for the page. */

const VOTERS = ["Neko", "juno", "wisp", "orla", "kade"];
const THRESHOLD = 0.5;
const NEEDED = Math.max(1, Math.ceil(VOTERS.length * THRESHOLD));

const MODES = [
  {
    id: "hybrid",
    label: "Hybrid",
    line: "The DJ skips outright. Everyone else opens a vote.",
  },
  {
    id: "dj",
    label: "DJ only",
    line: "Only the DJ role skips. There is no vote to open.",
  },
  {
    id: "vote",
    label: "Vote",
    line: "Every skip is a vote, the DJ included.",
  },
];

/* The ladder hasDjPermissions() actually walks, in order. */
const LADDER = [
  ["DJ role", "@Selector", true],
  ["Server owner", "always", true],
  ["Administrator", "unless strict", false],
  ["Manage Server", "unless strict", false],
  ["Manage Channels", "unless strict", false],
];

export default function DjResponse() {
  const [mode, setMode] = useState("hybrid");
  const [strict, setStrict] = useState(false);
  const voted = mode === "dj" ? 0 : 3;
  const active = MODES.find((entry) => entry.id === mode);

  return (
    <div>
      <p className="resp-lead">
        DJ mode gates the destructive controls behind a role, a vote, or both — and it is the
        server&rsquo;s decision which. Pick a mode.
      </p>

      <div className="dj-modes">
        {MODES.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={mode === entry.id ? "mode is-on" : "mode"}
            onClick={() => setMode(entry.id)}
            aria-pressed={mode === entry.id}
          >
            {entry.label}
          </button>
        ))}
        <span className="dj-role mono">skipmode · {mode}</span>
      </div>

      <div className="dj-grid">
        <div className="vote">
          <div className="vote-head">
            <b>Skip &ldquo;Tamagotchi&rdquo;?</b>
            <span className="mono vote-count">
              {mode === "dj" ? "instant" : `${voted} / ${VOTERS.length}`}
            </span>
          </div>

          {mode === "dj" ? (
            <p className="dj-blocked">
              <span className="mono">@Selector</span> skips it. Anyone else is told who to ask.
            </p>
          ) : (
            <>
              <div
                className="vote-bar"
                role="img"
                aria-label={`${voted} of ${VOTERS.length} votes cast, ${NEEDED} needed`}
              >
                <span style={{ width: `${(voted / VOTERS.length) * 100}%` }} />
                <em style={{ left: `${THRESHOLD * 100}%` }} />
              </div>

              <div className="vote-legend">
                <span className="mono">threshold {THRESHOLD * 100}%</span>
                <span className="mono">passes at {NEEDED}</span>
              </div>

              <div className="vote-people">
                {VOTERS.map((name, index) => (
                  <span key={name} className={index < voted ? "chip is-voted" : "chip"}>
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* With DJ mode on, a non-DJ's /play does not queue anything — it
              becomes a proposal the DJ approves or rejects. See
              commands/music/play.js, the config.enabled && !isDj branch. */}
          <div className="dj-props">
            <span className="mono dj-props-label">Awaiting the DJ</span>
            <div className="dj-prop">
              <span className="dj-prop-track">
                <b>Rosemary</b>
                <small>Deftones &middot; suggested by orla</small>
              </span>
              <span className="dj-prop-acts mono">
                <span className="dj-prop-yes">approve</span>
                <span>reject</span>
              </span>
            </div>
          </div>

          <p className="dj-mode-line">{active.line}</p>
        </div>

        <div className="dj-gate">
          <div className="dj-gate-head">
            <h4>Who can act</h4>
            <button
              type="button"
              className={strict ? "dj-strict is-on" : "dj-strict"}
              onClick={() => setStrict((value) => !value)}
              aria-pressed={strict}
            >
              strict {strict ? "on" : "off"}
            </button>
          </div>

          <ul className="dj-ladder">
            {LADDER.map(([name, detail, always]) => {
              const allowed = always || !strict;
              return (
                <li key={name} className={allowed ? "is-allowed" : ""}>
                  <span className="dj-rung">{name}</span>
                  <span className="mono dj-rung-note">{allowed ? detail : "blocked"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p className="resp-foot mono">
        Votes expire after five minutes and reset when the channel changes. Threshold is settable
        from 10% to 100%; the server owner keeps control whatever the mode says.
      </p>
    </div>
  );
}
