import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCommands } from "../api.js";
import PageShell from "../site/PageShell.jsx";
import usePageMeta from "../site/usePageMeta.js";
import "./reference.css";

/* A command's notes arrive as one string of bullet lines, because that is what
   a Discord embed wants. A page can do better than a run of glued-up bullets. */
function toLines(notes) {
  if (!notes) return [];
  return String(notes)
    .split("\n")
    .map((line) => line.replace(/^[\s•\-–*]+/, "").trim())
    .filter(Boolean);
}

/* The guide sections carry Discord's markdown. Two marks are actually used —
   bold and inline code — and rendering exactly those two beats both shipping a
   markdown parser and showing people raw asterisks. */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function Inline({ text }) {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${index}-${part}`;
      if (part.startsWith("**") && part.endsWith("**")) return <b key={key}>{part.slice(2, -2)}</b>;
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code className="mono" key={key}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={key}>{part}</span>;
    });
}

/* Consecutive bullets become one list; anything else stays a paragraph, so a
   section opening with a sentence does not turn that sentence into a bullet. */
function toBlocks(value) {
  const blocks = [];
  for (const raw of String(value).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const isBullet = /^[-•*]\s+/.test(line);
    const text = line.replace(/^[-•*]\s+/, "");
    const last = blocks[blocks.length - 1];
    if (isBullet && last && last.type === "list") last.items.push(text);
    else if (isBullet) blocks.push({ type: "list", items: [text] });
    else blocks.push({ type: "text", text });
  }
  return blocks;
}

function GuideNote({ note }) {
  return (
    <section className="note">
      {note.name ? <h3>{note.name}</h3> : null}
      {toBlocks(note.value).map((block, index) =>
        block.type === "list" ? (
          <ul className="cmd-notes" key={`l${index}`}>
            {block.items.map((item) => (
              <li key={item}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="note-text" key={`t${index}`}>
            <Inline text={block.text} />
          </p>
        )
      )}
    </section>
  );
}

function matches(command, needle) {
  return (
    command.name.toLowerCase().includes(needle) ||
    command.description.toLowerCase().includes(needle) ||
    command.usage.toLowerCase().includes(needle)
  );
}

function Command({ command, category }) {
  const notes = toLines(command.notes);
  const usage = command.usage.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <article className="cmd">
      <div className="cmd-head">
        <b className="mono cmd-name">/{command.name}</b>
        {category ? <span className="mono cmd-cat">{category}</span> : null}
      </div>

      <p className="cmd-desc">{command.description}</p>

      {/* The signature is data, so it is mono — and it is the line people came
          to copy, so it gets the well rather than the prose treatment. */}
      <div className="cmd-usage mono">
        {usage.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      {notes.length > 0 ? (
        <ul className="cmd-notes">
          {notes.map((note) => (
            <li key={note}>
              <Inline text={note} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function HelpPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  usePageMeta("Commands", "Every MewBit slash command, searchable — playback, playlists, queue, equalizer, DJ, moderation and tickets.");

  useEffect(() => {
    let cancelled = false;
    getCommands()
      .then((payload) => !cancelled && setData(payload))
      .catch((apiError) => !cancelled && setError(apiError.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // `/` focuses the filter, the same key the landing page's command line uses.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categories = data?.categories ?? [];
  const activeKey = params.get("c") || data?.defaultCategory || categories[0]?.key;
  const active = categories.find((category) => category.key === activeKey) || categories[0];

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return null;
    return categories.flatMap((category) =>
      category.commands.filter((command) => matches(command, needle)).map((command) => ({ command, category }))
    );
  }, [categories, needle]);

  const total = categories.reduce((sum, category) => sum + category.commands.length, 0);

  const lead = data
    ? `${total} commands, read straight from the instance serving this page — so this is what your deployment actually answers to, not what a published page once claimed.`
    : "Read straight from the instance serving this page.";

  return (
    <PageShell title="Every command MewBit answers to." lead={lead}>
      {error && !data ? (
        <p className="ref-error">{error}</p>
      ) : !data ? (
        <div aria-busy="true" className="ref-loading">
          <span className="ref-skel" />
          <span className="ref-skel is-short" />
        </div>
      ) : (
        <div className="ref">
          <aside className="ref-nav" aria-label="Command categories">
            <div className="ref-search">
              <span className="mono ref-search-prompt" aria-hidden="true">
                /
              </span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Filter commands"
                aria-label="Filter commands"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <ul className="ref-cats">
              {categories.map((category) => (
                <li key={category.key}>
                  <button
                    type="button"
                    className={!needle && category.key === active?.key ? "ref-cat is-on" : "ref-cat"}
                    aria-current={!needle && category.key === active?.key ? "true" : undefined}
                    onClick={() => {
                      setQuery("");
                      setParams({ c: category.key }, { replace: true });
                    }}
                  >
                    <b>{category.label}</b>
                    <small>
                      {category.commands.length} {category.commands.length === 1 ? "command" : "commands"}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="ref-body">
            {results ? (
              results.length === 0 ? (
                <p className="ref-empty">
                  Nothing matches “{query.trim()}”. Try a shorter word, or browse a category.
                </p>
              ) : (
                <>
                  <p className="mono ref-count">
                    {results.length} {results.length === 1 ? "match" : "matches"}
                  </p>
                  {results.map(({ command, category }) => (
                    <Command key={`${category.key}-${command.name}`} command={command} category={category.label} />
                  ))}
                </>
              )
            ) : active ? (
              <>
                <div className="ref-intro">
                  <h2>{active.label}</h2>
                  <p>{active.description}</p>
                  {(active.notes || []).map((note) => (
                    <GuideNote key={note.name || note.value.slice(0, 24)} note={note} />
                  ))}
                </div>

                {active.commands.map((command) => (
                  <Command key={command.name} command={command} />
                ))}
              </>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}
