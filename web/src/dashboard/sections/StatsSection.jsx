/**
 * This server's listening history. Read-only: it is the one section that
 * reports rather than configures, so it carries no controls and no save state.
 */

function formatDuration(ms) {
  const minutes = Math.round(Number(ms) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatHour(entry) {
  if (!entry || !Number.isFinite(Number(entry.hour))) return "—";
  return `${String(entry.hour).padStart(2, "0")}:00`;
}

export default function StatsSection({ settings }) {
  const stats = settings.stats;

  if (!stats.hasData) {
    return (
      <div className="notice">
        <b>Nothing has been played in this server yet.</b>
        <p>Counts appear here after the first track finishes. Nothing is recorded until then.</p>
      </div>
    );
  }

  const cards = [
    { label: "Tracks played", value: stats.songsPlayed.toLocaleString() },
    { label: "Listening time", value: formatDuration(stats.msPlayed) },
    { label: "Sessions", value: stats.totalSessions.toLocaleString() },
    { label: "Average session", value: formatDuration(stats.averageSessionMs) },
    { label: "Listeners", value: stats.uniqueListeners.toLocaleString() },
    { label: "Peak in one room", value: stats.peakListeners.toLocaleString() },
    { label: "Skipped", value: stats.songsSkipped.toLocaleString() },
    { label: "Playlists saved", value: stats.playlistsAdded.toLocaleString() },
  ];

  const total = stats.topSources.reduce((sum, entry) => sum + Number(entry.count || 0), 0);

  return (
    <>
      <div className="statgrid">
        {cards.map((card) => (
          <div className="statcard" key={card.label}>
            <span className="statcard-label">{card.label}</span>
            <b className="statcard-value">{card.value}</b>
          </div>
        ))}
      </div>

      {stats.topSources.length > 0 ? (
        <div className="statblock">
          <h3>Where it resolved from</h3>
          <div className="bars">
            {stats.topSources.map((entry) => {
              const share = total > 0 ? Math.round((Number(entry.count) / total) * 100) : 0;
              return (
                <div className="bar" key={entry.source}>
                  <span className="mono bar-name">{entry.source}</span>
                  <span className="bar-track" aria-hidden="true">
                    <span className="bar-fill" style={{ width: `${share}%` }} />
                  </span>
                  <span className="mono bar-value">{share}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="statblock">
        <h3>Timeline</h3>
        <dl className="deflist">
          <div>
            <dt>First track</dt>
            <dd>{formatDate(stats.firstPlayedAt)}</dd>
          </div>
          <div>
            <dt>Last track</dt>
            <dd>{formatDate(stats.lastPlayedAt)}</dd>
          </div>
          <div>
            <dt>Busiest hour</dt>
            <dd>{formatHour(stats.mostActiveHour)}</dd>
          </div>
        </dl>
        <p className="statblock-note">
          These are this server&rsquo;s numbers only. Per-member figures live in <code className="mono">/stats</code> and{" "}
          <code className="mono">/wrapped</code>.
        </p>
      </div>
    </>
  );
}
