import CoverArt from "../CoverArt.jsx";

const RESULTS = [
  { art: "tamagotchi", title: "Tamagotchi", artist: "TACONAFIDE", source: "Deezer", time: "3:25", flac: true },
  { art: "nightdrive", title: "Night Drive", artist: "Chiasm", source: "SoundCloud", time: "4:12", flac: false },
  { art: "signallost", title: "Signal Lost", artist: "Kavinsky", source: "YouTube", time: "5:03", flac: false },
];

export default function PlayResponse() {
  return (
    <div>
      <p className="resp-lead">
        One query, four providers. Results keep the source they actually resolved from, so you always
        know what is about to play.
      </p>

      {RESULTS.map((track) => (
        <div
          className="qrow"
          key={track.title}
        >
          <CoverArt art={track.art} title={track.title} />
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
      <p className="resp-foot mono">Ranked across every provider that answered — title, artist and duration are matched before anything plays.</p>
    </div>
  );
}
