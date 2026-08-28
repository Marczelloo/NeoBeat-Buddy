import { useEffect, useRef, useState } from "react";

export default function CommandLine({ query, onQueryChange, onRun, onNudge, ghost, typing, onInteract }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const showGhost = query.length === 0;

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
            onFocus={() => {
              setFocused(true);
              onInteract();
            }}
            onBlur={() => setFocused(false)}
            aria-label="Try a MewBit command"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {showGhost ? (
            <span className="cmdline-ghost" aria-hidden="true">
              <span>{ghost}</span>
              {/* The caret holds steady while characters are moving and blinks
                  on the finished line — the way a real one behaves. */}
              {focused ? null : (
                <span className={typing ? "cmdline-caret is-busy" : "cmdline-caret"} />
              )}
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
