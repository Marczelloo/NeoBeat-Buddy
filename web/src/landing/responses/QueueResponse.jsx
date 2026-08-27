const QUEUE = [
  { art: "T", title: "Tamagotchi", artist: "TACONAFIDE", by: "queued by Neko", time: "3:25", playing: true },
  { art: "R", title: "Rezerwacja", artist: "Taco Hemingway", by: "queued by Neko", time: "3:58" },
  { art: "M", title: "Midnight City", artist: "M83", by: "queued by juno", time: "4:03" },
  { art: "O", title: "Outrun", artist: "Kavinsky", by: "picked by autoplay", time: "4:40", auto: true },
];

export default function QueueResponse() {
  return (
    <div>
      <p className="resp-lead">
        Autoplay keeps its own provenance mark, so nobody wonders who queued the track that just
        started.
      </p>

      {QUEUE.map((track) => (
        <div className="qrow" key={track.title}>
          <span className="qart" aria-hidden="true">
            {track.art}
          </span>
          <span className="qmeta">
            <b>{track.title}</b>
            <small>
              {track.artist} · {track.by}
            </small>
            {track.auto ? (
              <span className="qsub">
                <span className="autotag">Autoplay next</span>
                <span className="qtime">{track.time}</span>
              </span>
            ) : (
              <span className="qsub">
                <span className="qtime">{track.time}</span>
              </span>
            )}
          </span>
          {track.playing ? (
            <span className="eqchip" aria-label="Now playing">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className="qtime" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
