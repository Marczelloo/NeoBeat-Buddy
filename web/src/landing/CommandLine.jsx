import { useEffect, useRef, useState } from "react";
import { COMMANDS } from "./commands.js";

const GHOST_INTERVAL_MS = 2600;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function CommandLine({ query, onQueryChange, onRun, onNudge }) {
  const [ghostIndex, setGhostIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const showGhost = query.length === 0;
  const cycling = showGhost && !focused;

  useEffect(() => {
    if (!cycling || prefersReducedMotion()) return undefined;

    const timer = setInterval(() => {
      setGhostIndex((current) => (current + 1) % COMMANDS.length);
    }, GHOST_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [cycling]);

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onRun();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onQueryChange("");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onNudge(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onNudge(-1);
    }
  }

  return (
    <div className="cmdline-shell">
      <div className="cmdline">
        <span className="cmdline-prompt" aria-hidden="true">
          &gt;
        </span>

        <span className="cmdline-field">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Try a MewBit command"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {showGhost ? (
            <span className="cmdline-ghost" aria-hidden="true">
              <span>{COMMANDS[ghostIndex].signature}</span>
              {focused ? null : <span className="cmdline-caret" />}
            </span>
          ) : null}
        </span>

        <span className="cmdline-enter" aria-hidden="true">
          <span className="key">↵</span>
          run
        </span>
      </div>
    </div>
  );
}
