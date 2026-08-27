const RESULTS = [
  { art: "T", title: "Tamagotchi", artist: "TACONAFIDE", source: "Deezer", time: "3:25", flac: true },
  { art: "N", title: "Night Drive", artist: "Chiasm", source: "SoundCloud", time: "4:12", flac: false },
  { art: "S", title: "Signal Lost", artist: "Kavinsky", source: "YouTube", time: "5:03", flac: false },
];

export default function PlayResponse() {
  return (
    <div>
      <p className="resp-lead">
        One query, four providers. Results keep the source they actually resolved from, so you always
        know what is about to play.
      </p>

      {RESULTS.map((track) => (
        <div className="qrow" key={track.title}>
          <span className="qart" aria-hidden="true">
            {track.art}
          </span>
          <span className="qmeta">
            <b>{track.title}</b>
            <small>{track.artist}</small>
            <span className="qsub">
              <span className="srctag">{track.source}</span>
              {track.flac ? <span className="srctag">FLAC</span> : null}
              <span className="qtime">{track.time}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
