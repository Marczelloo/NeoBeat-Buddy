import { DotsThree, MagnifyingGlass, Play, Plus } from "@phosphor-icons/react";
import CoverArt from "../CoverArt.jsx";

const RESULTS = [
  { art: "signallost", title: "FRASCATI", artist: "Taco Hemingway - Topic", source: "YouTube", time: "2:58" },
  { art: "tamagotchi", title: "Tamagotchi", artist: "Taconafide", source: "Deezer", time: "3:25", flac: true },
  { art: "nightdrive", title: "Night Drive", artist: "Chiasm", source: "SoundCloud", time: "4:12" },
  { art: "nightdrive", title: "Nastepna stacja", artist: "Taco Hemingway - Topic", source: "YouTube", time: "4:12" },
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
