import { useEffect, useState } from "react";
import { getPublicStats } from "../api.js";
import "./stats.css";

const NUM = new Intl.NumberFormat("en-US");

function hours(ms) {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(ms / 60_000)} min`;
  return `${NUM.format(Math.round(h))} h`;
}

function minutes(ms) {
  return `${Math.max(1, Math.round(ms / 60_000))} min`;
}

function since(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (days < 1) return "today";
  if (days < 30) return plural(days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return plural(months, "month");
  return plural(Math.round(days / 365), "year");
}

/**
 * Real figures from the instance serving this page. Nothing here is invented
 * and nothing is rounded up; a small deployment reads small, which is the
 * honest thing for a self-hosted product to show.
 */
export default function LiveStats() {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    getPublicStats()
      .then((payload) => !cancelled && setState({ status: "ready", data: payload.instance }))
      .catch(() => !cancelled && setState({ status: "down", data: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "down") {
    return (
      <section className="statline" aria-label="Instance statistics">
        <p className="statline-note">
          This instance is not answering right now, so its figures are unavailable.
        </p>
      </section>
    );
  }

  const loading = state.status === "loading";
  const d = state.data;

  const figures = loading
    ? []
    : [
        { label: "Servers", value: NUM.format(d.servers) },
        { label: "Tracks played", value: NUM.format(d.songsPlayed) },
        { label: "Listening time", value: hours(d.msPlayed) },
        { label: "Listeners", value: NUM.format(d.uniqueListeners) },
        { label: "Sessions", value: NUM.format(d.totalSessions) },
        { label: "Peak in one room", value: NUM.format(d.peakListeners) },
        { label: "Avg session", value: d.totalSessions > 0 ? minutes(d.averageSessionMs) : "—" },
        { label: "Playlists saved", value: NUM.format(d.playlistsAdded) },
      ];

  const running = loading ? null : since(d.firstPlayedAt);
  const sources = loading ? [] : d.topSources || [];
  const sourceTotal = sources.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="statline" aria-label="Instance statistics">
      <div className="statline-head">
        <h2>This instance, right now.</h2>
        <span className="mono statline-ver">
          {loading ? "reading…" : `v${d.version}`}
          {running ? ` · playing for ${running}` : ""}
        </span>
      </div>

      <dl className="statgrid">
        {(loading ? Array.from({ length: 8 }) : figures).map((figure, index) => (
          <div className="statcell" key={figure ? figure.label : index}>
            <dt>{figure ? figure.label : ""}</dt>
            <dd className="mono">{figure ? figure.value : "—"}</dd>
          </div>
        ))}
      </dl>

      {sources.length > 0 ? (
        <div className="statsources">
          <span className="mono statsources-label">Where it resolved from</span>
          <div className="statbar">
            {sources.map((entry) => (
              <span
                key={entry.source}
                className="statbar-part"
                style={{ flexGrow: entry.count }}
                title={`${entry.source}: ${NUM.format(entry.count)}`}
              >
                <b className="mono">{entry.source}</b>
                <i className="mono">{Math.round((entry.count / sourceTotal) * 100)}%</i>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="statline-note">
        Live from the deployment serving this page — not a network total. Your own instance shows
        your own numbers.
      </p>
    </section>
  );
}
