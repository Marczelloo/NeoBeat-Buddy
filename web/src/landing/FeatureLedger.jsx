import Reveal from "./Reveal.jsx";

/* Every entry here is verifiable in the repository. No metrics attached. */
const LEDGER = [
  {
    group: "Playback",
    items: [
      ["Sources", "Deezer, Spotify, SoundCloud, YouTube"],
      ["Quality", "FLAC through Deezer"],
      ["Engine", "Lavalink via Poru"],
      ["Always on", "24/7 radio mode per server"],
    ],
  },
  {
    group: "Selection",
    items: [
      ["Autoplay", "v3, with artist and album streak limits"],
      ["Provenance", "Autoplay picks stay marked in the queue"],
      ["Playlists", "Saved per user, importable from a URL"],
      ["History", "Per-server search and play history"],
    ],
  },
  {
    group: "Control",
    items: [
      ["DJ mode", "Role gating, vote skip, strict mode"],
      ["Equalizer", "22 presets, custom presets per user"],
      ["Filters", "Preset filter chains on top of the EQ"],
      ["Lyrics", "Synced, with per-user timing offset"],
    ],
  },
  {
    group: "Surfaces",
    items: [
      ["Discord Activity", "A shared visual player in the voice channel"],
      ["Player embed", "Full transport in the text channel"],
      ["Dashboard", "This web surface, for server settings"],
      ["Statistics", "Per-guild and per-user listening stats"],
    ],
  },
];

export default function FeatureLedger() {
  return (
    <section className="ledger" aria-labelledby="ledger-heading">
      <h2 id="ledger-heading">Everything is in the box.</h2>
      <p className="ledger-lead">
        There is no premium tier, because there is no tier. What the bot can do, your deployment
        does.
      </p>

      <div className="ledger-grid">
        {LEDGER.map((group, index) => (
          <Reveal className="ledger-group" key={group.group} delay={index * 0.04}>
            <h3>{group.group}</h3>
            <dl>
              {group.items.map(([term, detail]) => (
                <div className="ledger-row" key={term}>
                  <dt>{term}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
