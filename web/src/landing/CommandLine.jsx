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

  // "/" focuses the palette from anywhere, the way a command surface behaves.
  useEffect(() => {
    function onKey(event) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onRun();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onQueryChange("");
      inputRef.current?.blur();
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
          <span className="key">{focused || query ? "↵" : "/"}</span>
          <span className="enter-word">{focused || query ? "run" : "to focus"}</span>
        </span>
      </div>
    </div>
  );
}
