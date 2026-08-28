import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { repoUrl } from "../api.js";
import ActivityShowcase from "./ActivityShowcase.jsx";
import CommandLine from "./CommandLine.jsx";
import FeatureLedger from "./FeatureLedger.jsx";
import LiveStats from "./LiveStats.jsx";
import Mark from "./Mark.jsx";
import ResponseCanvas from "./ResponseCanvas.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { COMMANDS, DEFAULT_COMMAND_ID, filterCommands } from "./commands.js";
import "./landing.css";

export default function Landing() {
  const groundRef = useRef(null);
  const [query, setQuery] = useState("");

  // The hero art drifts a little slower than the page. Cheap, capped, and
  // skipped entirely under reduced motion.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const shift = Math.min(window.scrollY * 0.18, 90);
        groundRef.current?.style.setProperty("--ground-shift", `${shift}px`);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
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
    <main className="landing" ref={groundRef}>
      <div className="wrap">
        <header className="topbar">
          <span className="mark">
            <Mark size={26} animated />
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

        {/* The offer in one line, then straight into the palette — the page's
            thesis is the command line, so nothing stacks above it. */}
        <h1 className="lede">
          A Discord music bot <em>you</em> run yourself.
        </h1>

        <CommandLine query={query} onQueryChange={setQuery} onRun={run} onNudge={nudge} />

        <ResponseCanvas commandId={activeId} />

        <section className="index" aria-label="MewBit commands">
          {visible.map((command) =>
            command.cta ? (
              <a
                key={command.id}
                className="index-row is-cta"
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                onMouseEnter={() => setActiveId(command.id)}
                onFocus={() => setActiveId(command.id)}
              >
                <span className="index-sig">{command.signature}</span>
                <span className="index-blurb">{command.blurb}</span>
                <span className="index-go">open the repository →</span>
              </a>
            ) : (
              <button
                type="button"
                key={command.id}
                className={command.id === activeId ? "index-row is-active" : "index-row"}
                onClick={() => setActiveId(command.id)}
                onMouseEnter={() => setActiveId(command.id)}
                onFocus={() => setActiveId(command.id)}
                aria-pressed={command.id === activeId}
              >
                <span className="index-sig">{command.signature}</span>
                <span className="index-blurb">{command.blurb}</span>
                <span className="index-go">show</span>
              </button>
            )
          )}

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

        <p className="pitch">
          Multi-source search across Deezer, Spotify, SoundCloud and YouTube. FLAC playback, DJ
          controls, a real equalizer, synced lyrics and playlists — on your own hardware, with no
          tier that takes any of it away.
        </p>

        <LiveStats />
        <ActivityShowcase />
        <FeatureLedger />
        <SiteFooter />
      </div>
    </main>
  );
}
