import CoverArt from "../CoverArt.jsx";

const QUEUE = [
  { art: "tamagotchi", title: "Tamagotchi", artist: "TACONAFIDE", by: "queued by Neko", time: "3:25", playing: true },
  { art: "signallost", title: "Signal Lost", artist: "Kavinsky", by: "queued by Neko", time: "5:03" },
  { art: "nightdrive", title: "Night Drive", artist: "Chiasm", by: "queued by juno", time: "4:12" },
  { art: "nightdrive", title: "Outrun", artist: "Kavinsky", by: "picked by autoplay", time: "4:40", auto: true },
];

export default function QueueResponse() {
  return (
    <div>
      <p className="resp-lead">
        Autoplay keeps its own provenance mark, so nobody wonders who queued the track that just
        started.
      </p>

      {QUEUE.map((track) => (
        <div
          className="qrow"
          key={track.title}
        >
          <CoverArt art={track.art} title={track.title} />
          <span className="qmeta">
            <b>{track.title}</b>
            <small>
              {track.artist} · {track.by}
            </small>
            <span className="qsub">
              {track.auto ? <span className="autotag">Autoplay next</span> : null}
              <span className="qtime">{track.time}</span>
            </span>
          </span>
          {track.playing ? (
            <span className="eqchip" aria-label="Now playing">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </div>
      ))}
      <p className="resp-foot mono">Rows reorder by drag in the Activity. When the queue empties, autoplay keeps the room going.</p>
    </div>
  );
}
