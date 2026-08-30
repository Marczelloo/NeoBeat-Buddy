import { useEffect, useState } from "react";
import { getChangelog } from "../api.js";
import PageShell from "../site/PageShell.jsx";
import usePageMeta from "../site/usePageMeta.js";
import "../help/reference.css";

const GROUPS = [
  ["features", "New"],
  ["fixes", "Fixed"],
  ["changes", "Changed"],
];

function formatDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function ChangelogPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  usePageMeta("Changelog", "Every MewBit release, what changed in it, and which version this instance is running.");

  useEffect(() => {
    let cancelled = false;
    getChangelog()
      .then((payload) => !cancelled && setData(payload))
      .catch((apiError) => !cancelled && setError(apiError.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const lead = data
    ? `This instance runs v${data.current}. Every release below is the record the bot itself keeps — the same notes /changelog reads out in Discord.`
    : "The record the bot itself keeps.";

  return (
    <PageShell title="What changed, and when." lead={lead}>
      {error && !data ? (
        <p className="ref-error">{error}</p>
      ) : !data ? (
        <div aria-busy="true" className="ref-loading">
          <span className="ref-skel" />
          <span className="ref-skel is-short" />
        </div>
      ) : (
        <div className="rel-list">
          {data.releases.map((release) => (
            <article className="rel" key={release.version}>
              {/* Version and date hold the left column, the way the feature
                  ledger's group heads do, so the page scans by release. */}
              <div className="rel-side">
                <b className="mono rel-ver">v{release.version}</b>
                {release.version === data.current ? (
                  <span className="mono rel-current">running here</span>
                ) : null}
                <time className="rel-date" dateTime={release.date || undefined}>
                  {formatDate(release.date)}
                </time>
              </div>

              <div className="rel-body">
                <h2>{release.title}</h2>

                {GROUPS.map(([key, label]) =>
                  release[key].length > 0 ? (
                    <section className="rel-group" key={key}>
                      <h3 className="mono">{label}</h3>
                      <ul>
                        {release[key].map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
