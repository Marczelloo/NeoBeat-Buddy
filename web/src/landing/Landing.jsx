import { useEffect, useMemo, useRef, useState } from "react";
import { repoUrl } from "../api.js";
import ActivityShowcase from "./ActivityShowcase.jsx";
import CommandLine from "./CommandLine.jsx";
import FeatureLedger from "./FeatureLedger.jsx";
import HeroField from "./HeroField.jsx";
import LiveStats from "./LiveStats.jsx";
import ResponseCanvas from "./ResponseCanvas.jsx";
import SectionRule from "./SectionRule.jsx";
import SiteFooter from "./SiteFooter.jsx";
import TopBar from "../site/TopBar.jsx";
import useAutotype from "./autotype.js";
import { COMMANDS, DEFAULT_COMMAND_ID, filterCommands, findCommand } from "./commands.js";
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
  // Sections settle in as they arrive. The hidden state is added by this
  // effect rather than by the stylesheet, so if the script never runs the page
  // is simply a page — nothing is hidden behind an observer that never fires.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const targets = document.querySelectorAll(
      ".showcase-head, .ex-lead, .ex-panel, .ex-close, .ledger-block, .foot-close, .foot-cols"
    );
    if (targets.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          // One-shot: replaying the entrance every time you scroll back up is
          // motion for its own sake.
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    targets.forEach((target) => {
      /* Anything already at or above the fold is shown outright. A reload
         restores the scroll position, and an observer never reports an element
         that was already behind you — it would sit at opacity 0 until someone
         scrolled up into a blank section. This also spares whatever is on
         screen at load an entrance it did not need. */
      if (target.getBoundingClientRect().top < window.innerHeight) {
        target.classList.add("reveal", "is-in");
        return;
      }

      target.classList.add("reveal");
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);

  const [activeId, setActiveId] = useState(DEFAULT_COMMAND_ID);

  /* The palette demonstrates itself until someone reaches for it. The first
     real interaction — a focus, a keystroke, a hover on the index — ends the
     demo for good; a page that keeps typing over you is a page fighting you. */
  const [live, setLive] = useState(true);
  const demo = useAutotype(live);

  useEffect(() => {
    if (live) setActiveId(demo.id);
  }, [live, demo.id]);

  function takeOver() {
    setLive(false);
  }

  const visible = useMemo(() => filterCommands(query), [query]);

  /* Once the demo stops — or never starts, under reduced motion — the field
     falls back to naming the command the canvas is showing. An empty prompt
     with a bare caret tells nobody what to type. */
  const ghost = demo.running ? demo.text : findCommand(activeId).signature;

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
      {/* Drawn brand plate, not a photograph — see HeroField. */}
      <div className="hero-plate" aria-hidden="true">
        <HeroField />
      </div>

      <div className="wrap">
        <TopBar animated />

        {/* The offer in one line, then straight into the palette — the page's
            thesis is the command line, so nothing stacks above it. */}
        <h1 className="lede">
          A Discord music bot <em>you</em> run yourself.
        </h1>

        <CommandLine
          query={query}
          onQueryChange={(value) => {
            takeOver();
            setQuery(value);
          }}
          onRun={run}
          onNudge={nudge}
          ghost={ghost}
          typing={demo.typing}
          onInteract={takeOver}
        />

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
                onMouseEnter={() => {
                  takeOver();
                  setActiveId(command.id);
                }}
                onFocus={() => {
                  takeOver();
                  setActiveId(command.id);
                }}
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
                onClick={() => {
                  takeOver();
                  setActiveId(command.id);
                }}
                onMouseEnter={() => {
                  takeOver();
                  setActiveId(command.id);
                }}
                onFocus={() => {
                  takeOver();
                  setActiveId(command.id);
                }}
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
        <SectionRule seed="a" />
        <ActivityShowcase />
        <SectionRule seed="b" />
        <FeatureLedger />
        <SectionRule seed="c" />
        <SiteFooter />
      </div>
    </main>
  );
}
