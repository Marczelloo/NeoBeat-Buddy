import { useEffect, useState } from "react";
import { getPublicStats } from "../api.js";

const DASH = "—";

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatHours(ms) {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  return `${formatCount(Math.round(hours))} h`;
}

function formatUptime(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

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
      <section className="stats" aria-label="Instance statistics">
        <p className="stats-down">Instance stats are unavailable right now.</p>
      </section>
    );
  }

  const loading = state.status === "loading";
  const data = state.data;

  const figures = [
    { label: "Servers", value: loading ? DASH : formatCount(data.servers) },
    { label: "Tracks played", value: loading ? DASH : formatCount(data.songsPlayed) },
    { label: "Listening time", value: loading ? DASH : formatHours(data.msPlayed) },
    { label: "Uptime", value: loading ? DASH : formatUptime(data.uptimeMs) },
    { label: "Version", value: loading ? DASH : `v${data.version}` },
  ];

  return (
    <section className="stats" aria-label="Instance statistics">
      <dl className="stats-grid">
        {figures.map((figure) => (
          <div className="stat" key={figure.label}>
            <dt>{figure.label}</dt>
            <dd className="mono">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <p className="stats-caption">
        Live from this instance — the deployment serving this page, not a network total.
      </p>
    </section>
  );
}
