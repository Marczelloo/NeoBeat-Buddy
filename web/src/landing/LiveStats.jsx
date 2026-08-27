import { useEffect, useState } from "react";
import { getPublicStats } from "../api.js";

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 90) return `${minutes} min`;
  const hours = ms / 3_600_000;
  return `${formatCount(Math.round(hours))} h`;
}

/**
 * One hairline data line, not a row of metric tiles. These are the numbers of
 * a single deployment and are labelled as such; presenting them as a stat
 * board would argue for a scale that does not exist.
 */
export default function LiveStats() {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;

    getPublicStats()
      .then((payload) => {
        if (!cancelled) setState({ status: "ready", data: payload.instance });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "down", data: null });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "down") {
    return (
      <section className="statline" aria-label="Instance statistics">
        <p className="statline-text">Instance stats are unavailable right now.</p>
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section className="statline" aria-label="Instance statistics">
        <p className="statline-text mono">Reading this instance…</p>
      </section>
    );
  }

  const { servers, songsPlayed, msPlayed, version } = state.data;

  return (
    <section className="statline" aria-label="Instance statistics">
      <p className="statline-text mono">
        <span>{formatCount(servers)} servers</span>
        <span>{formatCount(songsPlayed)} tracks played</span>
        <span>{formatDuration(msPlayed)} listened</span>
        <span>v{version}</span>
      </p>
      <p className="statline-note">
        Live from this instance — the deployment serving this page, not a network total.
      </p>
    </section>
  );
}
