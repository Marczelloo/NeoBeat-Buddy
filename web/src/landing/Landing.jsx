import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { repoUrl } from "../api.js";
import CommandLine from "./CommandLine.jsx";
import ResponseCanvas from "./ResponseCanvas.jsx";
import { COMMANDS, DEFAULT_COMMAND_ID, filterCommands } from "./commands.js";
import "./landing.css";

export default function Landing() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(DEFAULT_COMMAND_ID);

  const visible = useMemo(() => filterCommands(query), [query]);

  function run() {
    if (visible.length === 0) return;
    setActiveId(visible[0].id);
    setQuery("");
  }

  function nudge(direction) {
    const pool = visible.length > 0 ? visible : COMMANDS;
    const index = pool.findIndex((command) => command.id === activeId);
    const next = (index + direction + pool.length) % pool.length;
    setActiveId(pool[next].id);
  }

  return (
    <main className="landing">
      <div className="wrap">
        <header className="topbar">
          <span className="mark">
            <span className="mark-signal" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            MewBit
          </span>

          <nav className="topbar-links">
            <Link className="toplink" to="/dashboard">
              Dashboard
            </Link>
            <a className="toplink" href={repoUrl} target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
          </nav>
        </header>

        <section className="hero">
          <h1>
            A Discord music bot <em>you</em> run yourself.
          </h1>
          <p>
            Multi-source search across Deezer, Spotify, SoundCloud and YouTube. FLAC playback, DJ
            controls, a real equalizer, synced lyrics and playlists — on your own hardware, with no
            tier that takes any of it away.
          </p>
          <div className="hero-facts">
            <span>Open source</span>
            <span>Self-hosted</span>
            <span>Lavalink</span>
            <span>Discord Activity included</span>
          </div>
        </section>

        <CommandLine query={query} onQueryChange={setQuery} onRun={run} onNudge={nudge} />

        <ResponseCanvas commandId={activeId} />

        <section className="index" aria-label="MewBit commands">
          {visible.map((command) => (
            <button
              type="button"
              key={command.id}
              className={[
                "index-row",
                command.id === activeId ? "is-active" : "",
                command.cta ? "is-cta" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveId(command.id)}
              onMouseEnter={() => setActiveId(command.id)}
              aria-pressed={command.id === activeId}
            >
              <span className="index-sig">{command.signature}</span>
              <span className="index-blurb">{command.blurb}</span>
              <span className="index-go">show</span>
            </button>
          ))}

          {visible.length === 0 ? (
            <p className="index-empty">
              No command matches “{query.trim()}”. MewBit ships far more than these five —{" "}
              <a href={repoUrl} target="_blank" rel="noreferrer noopener">
                the full list is in the repository
              </a>
              .
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
