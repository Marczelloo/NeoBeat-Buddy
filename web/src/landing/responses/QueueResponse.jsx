import { motion } from "motion/react";
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

      {QUEUE.map((track, index) => (
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
        </motion.div>
      ))}
    </div>
  );
}
