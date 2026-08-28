import { DotsThree, MagnifyingGlass, Play, Plus } from "@phosphor-icons/react";
import CoverArt from "../CoverArt.jsx";

const RESULTS = [
  { art: "dieforyou", title: "The Weeknd - Die For You (Official Video)", artist: "The Weeknd", source: "YouTube", time: "4:20" },
  { art: "loser", title: "Loser", artist: "Tame Impala", source: "Deezer", time: "3:59", flac: true },
  { art: "rosemary", title: "Rosemary", artist: "Deftones", source: "SoundCloud", time: "6:51" },
  { art: "avengers", title: "Avengers", artist: "Quebonafide, Eripe", source: "Spotify", time: "3:41" },
];

export default function PlayResponse() {
  return (
    <div>
      <div className="find">
        <span className="find-ico">
          <MagnifyingGlass size={17} />
        </span>
        <span>
          <b>Find a track</b>
          <small>Search providers together, then choose the exact source</small>
        </span>
      </div>

      <div className="results">
        {RESULTS.map((track, index) => (
          <div className={index === 0 ? "qrow is-hover" : "qrow"} key={track.title}>
            <CoverArt art={track.art} title={track.title} />
            <span className="qmeta">
              <b>{track.title}</b>
              <small>
                {track.artist} · {track.source}
                {track.flac ? " · FLAC" : ""}
              </small>
            </span>
            <span className="qtime">{track.time}</span>
            <span className="qacts">
              <Play size={15} weight="fill" />
              <Plus size={15} />
              <DotsThree size={17} weight="bold" />
            </span>
          </div>
        ))}
      </div>
      <p className="resp-foot mono">Ranked across every provider that answered — title, artist and duration are matched before anything plays.</p>
    </div>
  );
}
