import { ArrowUpRight, Waveform } from "@phosphor-icons/react";

/* The site's address is a deployment fact, not a build constant — this one
   moved hosts once already. It is offered only when a deployment names it; the
   repository is true for every deployment, so that link is always shown. */
const siteUrl = String(import.meta.env.VITE_MEWBIT_SITE_URL || "").replace(/\/$/, "");
const repoUrl = "https://github.com/Marczelloo/NeoBeat-Buddy";

const COPY = {
  outside: {
    title: "This player opens inside Discord.",
    body:
      "The MewBit Activity runs in a voice channel, where everyone in the room shares one queue, one set of artwork and one transport. Opened on its own it has no room to join — start it from the voice channel's activity shelf instead.",
  },
  notfound: {
    title: "There is no page here.",
    body:
      "The Activity is a single surface; it has no other addresses. If you were looking for what MewBit is, how to run it, or the command reference, that lives on the website.",
  },
};

/**
 * What a person sees when they reach the Activity outside Discord.
 *
 * Until now they got the full cockpit with nothing in it — a search field that
 * returns nothing and a transport that controls nothing — which reads as a
 * broken product rather than as the wrong door. It is built from the loader's
 * own parts (the ambient wash, the kicker) because it is the same world, but it
 * holds still: this is a destination, not a wait.
 */
export default function ActivityGate({ variant = "outside", path = "/" }) {
  const copy = COPY[variant] || COPY.outside;

  return (
    <section className="activity-gate" role="status">
      <div className="loader-ambient loader-ambient-cyan" aria-hidden="true" />
      <div className="loader-ambient loader-ambient-magenta" aria-hidden="true" />

      <div className="gate-content">
        <span className="loader-kicker">
          <i /> MEWBIT LINK
        </span>

        <h1>{copy.title}</h1>
        <p>{copy.body}</p>

        <div className="gate-actions">
          {variant === "notfound" ? (
            <a className="gate-btn is-primary" href="/">
              Open the Activity
            </a>
          ) : null}
          {siteUrl ? (
            <a
              className={variant === "notfound" ? "gate-btn" : "gate-btn is-primary"}
              href={siteUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              What MewBit is
              <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
            </a>
          ) : null}
          <a className="gate-btn" href={repoUrl} target="_blank" rel="noreferrer noopener">
            Run your own
            <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
          </a>
        </div>

        <p className="gate-foot">
          <Waveform size={13} weight="bold" aria-hidden="true" />
          <span className="gate-path">{path}</span>
        </p>
      </div>
    </section>
  );
}
