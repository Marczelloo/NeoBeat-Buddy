import {
  Bell,
  ClockCounterClockwise,
  Compass,
  Heart,
  House,
  MagnifyingGlass,
  MagnifyingGlassPlus,
  MusicNotes,
  Pause,
  Plus,
  Repeat,
  Shuffle,
  SidebarSimple,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  Stop,
  Trash,
  Waveform,
} from "@phosphor-icons/react";
import CoverArt from "./CoverArt.jsx";
import "./activity.css";

const UP_NEXT = [
  { art: "borderline", title: "Borderline", artist: "Tame Impala - Topic", eta: "Up next", time: "3:58" },
  { art: "rosemary", title: "Rosemary", artist: "Deftones - Topic", eta: "In 3:58", time: "6:51" },
];

const UP_NEXT_AUTO = [
  { art: "dieforyou", title: "Die For You", artist: "The Weeknd", eta: "In 10:49", time: "4:20" },
];

const LIBRARY = [
  { name: "Liked Songs", count: "0 tracks", liked: true },
  { name: "Late night rotation", count: "547 tracks", art: "rosemary" },
];

/**
 * The Activity player as it actually ships: library rail, player stage and a
 * live queue. Drawn from the running surface rather than invented, so the
 * page shows the product instead of describing it.
 */
export default function ActivityShowcase() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <div className="showcase-head">
        <h2 id="showcase-heading">The player lives inside Discord.</h2>
        <p>
          MewBit ships a Discord Activity: a shared cockpit that opens in the voice channel, so
          everyone works from the same queue, the same artwork and the same controls. The message
          embed stays as a fallback.
        </p>
      </div>

      <div className="app" role="img" aria-label="The MewBit Activity, shown with example content">
        <aside className="app-lib">
          <div className="app-lib-head">
            <b>Library</b>
            <span className="mono">2</span>
          </div>

          {LIBRARY.map((item) => (
            <div className="lib-row" key={item.name}>
              <span className="lib-art">
                {item.liked ? <Heart size={16} weight="fill" /> : <CoverArt art={item.art} title={item.name} />}
              </span>
              <span className="lib-meta">
                <b>{item.name}</b>
                <small>{item.count}</small>
              </span>
            </div>
          ))}

          <div className="lib-row is-new">
            <span className="lib-art">
              <Plus size={16} />
            </span>
            <span className="lib-meta">
              <b>New playlist</b>
            </span>
          </div>
        </aside>

        <div className="app-main">
          <div className="app-toolbar">
            <span className="tool-ico is-on">
              <Compass size={17} />
            </span>
            <span className="tool-ico is-on">
              <House size={17} />
            </span>

            <span className="tool-search">
              <MagnifyingGlass size={16} />
              <span className="tool-placeholder">What do you want to play?</span>
              <span className="tool-chip">YouTube first</span>
              <span className="tool-submit">
                <MagnifyingGlass size={14} weight="bold" />
              </span>
            </span>

            <span className="tool-ico">
              <SlidersHorizontal size={17} />
            </span>
            <span className="tool-ico">
              <Bell size={17} />
            </span>
            <span className="tool-ico is-on">
              <SidebarSimple size={17} />
            </span>
          </div>

          <div className="app-stage">
            <div className="stage-cover">
              <CoverArt art="loser" title="Loser" />
              <span className="stage-signal" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="stage-id">
              <h3>Tame Impala - Loser (Official Video)</h3>
              <p>tameimpalaVEVO</p>
              <span className="srcchip mono">YouTube</span>
              <span className="stage-added mono">added by marczelloo</span>
            </div>
          </div>

          <div className="app-deck">
            <span className="deck-auto">
              <Sparkle size={14} weight="fill" />
              Autoplay
            </span>
            <span className="deck-ico">
              <Heart size={16} />
            </span>
            <span className="deck-ico">
              <MagnifyingGlassPlus size={16} />
            </span>
            <span className="deck-ico">
              <Waveform size={16} />
            </span>

            <span className="deck-transport">
              <span className="deck-ico">
                <Repeat size={16} />
              </span>
              <span className="deck-ico">
                <SkipBack size={17} weight="fill" />
              </span>
              <span className="deck-play">
                <Pause size={18} weight="fill" />
              </span>
              <span className="deck-ico">
                <Stop size={16} weight="fill" />
              </span>
              <span className="deck-ico">
                <SkipForward size={17} weight="fill" />
              </span>
              <span className="deck-ico">
                <Shuffle size={16} />
              </span>
            </span>

            <span className="deck-right">
              <span className="deck-ico">
                <MusicNotes size={16} />
              </span>
              <span className="deck-ico">
                <SpeakerHigh size={16} />
              </span>
              <span className="deck-vol">
                <span />
              </span>
            </span>
          </div>

          <div className="app-seek">
            <span className="seek-track">
              <span className="seek-played" />
            </span>
            <span className="seek-times mono">
              <span>0:06</span>
              <span>4:12</span>
            </span>
          </div>
        </div>

        <aside className="app-queue">
          <div className="qpanel-head">
            <b>Queue</b>
            <span className="qpanel-count mono">3 up next</span>
            <ClockCounterClockwise size={15} />
            <Trash size={15} />
          </div>

          <div className="qpanel-label mono">From the room</div>

          {UP_NEXT.map((track, index) => (
            <div className="qrow" key={track.title}>
              <span className="qnum mono">{index + 1}</span>
              <CoverArt art={track.art} title={track.title} />
              <span className="qmeta">
                <b>{track.title}</b>
                <small>
                  {track.artist} · YouTube · {track.eta}
                </small>
              </span>
              <span className="qtime">{track.time}</span>
            </div>
          ))}

          <div className="qpanel-label mono is-auto">MewBit autoplay</div>

          {UP_NEXT_AUTO.map((track, index) => (
            <div className="qrow" key={track.title}>
              <span className="qnum mono">{UP_NEXT.length + index + 1}</span>
              <CoverArt art={track.art} title={track.title} />
              <span className="qmeta">
                <b>{track.title}</b>
                <small>
                  {track.artist} · YouTube · {track.eta}
                </small>
              </span>
              <span className="autobadge mono">Auto</span>
              <span className="qtime">{track.time}</span>
            </div>
          ))}
        </aside>
      </div>

      <p className="stage-note">Example session. Cover artwork belongs to its rights holders.</p>
    </section>
  );
}
