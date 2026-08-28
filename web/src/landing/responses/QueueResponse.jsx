import { ClockCounterClockwise, Trash } from "@phosphor-icons/react";
import CoverArt from "../CoverArt.jsx";

const ROOM = [
  { art: "loser", title: "Borderline", artist: "Tame Impala - Topic", eta: "Up next", time: "3:58" },
  { art: "rosemary", title: "Rosemary", artist: "Deftones - Topic", eta: "In 3:58", time: "6:51" },
];

const AUTO = [
  { art: "dieforyou", title: "Dracula", artist: "Tame Impala", eta: "In 10:49", time: "3:54" },
];

function Row({ track, index, auto }) {
  return (
    <div className="qrow">
      <span className="qnum mono">{index}</span>
      <CoverArt art={track.art} title={track.title} />
      <span className="qmeta">
        <b>{track.title}</b>
        <small>
          {track.artist} · YouTube · {track.eta}
        </small>
      </span>
      {auto ? <span className="autobadge mono">Auto</span> : null}
      <span className="qtime">{track.time}</span>
    </div>
  );
}

export default function QueueResponse() {
  return (
    <div>
      <p className="resp-lead">
        The queue is shared, and it separates what the room queued from what autoplay chose — so
        nobody wonders where a track came from.
      </p>

      <div className="qpanel">
        <div className="qpanel-head">
          <b>Queue</b>
          <span className="qpanel-count mono">{ROOM.length + AUTO.length} up next</span>
          <ClockCounterClockwise size={15} />
          <Trash size={15} />
        </div>

        <div className="qpanel-label mono">From the room</div>
        {ROOM.map((track, i) => (
          <Row key={track.title} track={track} index={i + 1} />
        ))}

        <div className="qpanel-label mono is-auto">MewBit autoplay</div>
        {AUTO.map((track, i) => (
          <Row key={track.title} track={track} index={ROOM.length + i + 1} auto />
        ))}
      </div>
      <p className="resp-foot mono">Rows reorder by drag in the Activity. When the room runs out, autoplay extends the queue on its own.</p>
    </div>
  );
}
