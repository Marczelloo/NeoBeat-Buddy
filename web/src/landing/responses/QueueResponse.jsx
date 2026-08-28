import { ClockCounterClockwise, Trash } from "@phosphor-icons/react";
import CoverArt from "../CoverArt.jsx";

const QUEUE = [
  { art: "signallost", title: "FRASCATI", artist: "Taco Hemingway - Topic", eta: null, time: "2:58" },
  { art: "tamagotchi", title: "Tamagotchi", artist: "Taconafide - Topic", eta: "2:58", time: "3:22" },
  { art: "nightdrive", title: "8 kobiet", artist: "Taconafide - Topic", eta: "6:20", time: "3:19" },
  { art: "nightdrive", title: "Outrun", artist: "Kavinsky - Topic", eta: "9:39", time: "4:40", auto: true },
];

export default function QueueResponse() {
  return (
    <div>
      <p className="resp-lead">
        The queue is shared. Everyone sees the same order, where each track resolved from, and how
        long until theirs comes up.
      </p>

      <div className="qpanel">
        <div className="qpanel-head">
          <b>Queue</b>
          <span className="qpanel-count mono">{QUEUE.length} up next</span>
          <ClockCounterClockwise size={15} />
          <Trash size={15} />
        </div>

        <div className="qpanel-label mono">From the room</div>

        {QUEUE.map((track, index) => (
          <div className="qrow" key={track.title}>
            <span className="qnum mono">{index + 1}</span>
            <CoverArt art={track.art} title={track.title} />
            <span className="qmeta">
              <b>{track.title}</b>
              <small>
                {track.artist} · YouTube
                {track.eta ? ` · In ${track.eta}` : ""}
              </small>
              {track.auto ? (
                <span className="qsub">
                  <span className="autotag">Autoplay next</span>
                </span>
              ) : null}
            </span>
            <span className="qtime">{track.time}</span>
          </div>
        ))}
      </div>
      <p className="resp-foot mono">Rows reorder by drag in the Activity. When the queue empties, autoplay keeps the room going.</p>
    </div>
  );
}
