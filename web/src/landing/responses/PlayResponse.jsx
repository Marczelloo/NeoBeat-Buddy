import { motion } from "motion/react";
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

      {RESULTS.map((track, index) => (
        <motion.div
          className="qrow"
          key={track.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.06 + index * 0.05, ease: [0.32, 0.72, 0, 1] }}
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
        </motion.div>
      ))}
    </div>
  );
}
