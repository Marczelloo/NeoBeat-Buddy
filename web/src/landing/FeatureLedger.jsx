/* Every entry here is verifiable in the repository. No metrics attached. */
const LEDGER = [
  {
    group: "Playback",
    items: [
      ["Sources", "Deezer, Spotify, SoundCloud and YouTube, searched together"],
      ["Quality", "FLAC through Deezer"],
      ["Engine", "Lavalink, driven through Poru"],
      ["Always on", "24/7 radio mode, per server"],
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
      ["DJ mode", "Role gating, vote skipping, strict mode"],
      ["Equalizer", "22 presets across ten bands, plus custom presets per user"],
      ["Filters", "Preset filter chains stacked on top of the EQ"],
      ["Lyrics", "Synced, with a per-user timing offset"],
    ],
  },
  {
    group: "Surfaces",
    items: [
      ["Discord Activity", "A shared visual player inside the voice channel"],
      ["Player embed", "Full transport in the text channel"],
      ["Dashboard", "This web surface, for per-server settings"],
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

      <dl className="ledger-rows">
        {LEDGER.map((group) => (
          <div className="ledger-block" key={group.group}>
            <h3>{group.group}</h3>
            {group.items.map(([term, detail]) => (
              <div className="ledger-row" key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}
