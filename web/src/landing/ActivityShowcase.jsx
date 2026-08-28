import { Heart, Pause, Repeat, Shuffle, SkipBack, SkipForward, SpeakerHigh } from "@phosphor-icons/react";
import CoverArt from "./CoverArt.jsx";

const QUEUE = [
  { art: "signallost", title: "Signal Lost", artist: "Kavinsky", time: "5:03" },
  { art: "nightdrive", title: "Night Drive", artist: "Chiasm", time: "4:12" },
  { art: "nightdrive", title: "Outrun", artist: "Kavinsky", time: "4:40", auto: true },
];

/**
 * The Activity player, drawn in the same token set it ships in. This is the
 * product doing its job — the page argues by showing the surface, not by
 * describing it.
 */
export default function ActivityShowcase() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <div className="showcase-head">
        <h2 id="showcase-heading">The player lives inside Discord.</h2>
        <p>
          MewBit ships a Discord Activity: a shared visual player that opens in the voice channel,
          so everyone sees the same queue, the same artwork and the same controls. The message embed
          stays as a fallback.
        </p>
      </div>

      <div className="stage" role="img" aria-label="The MewBit Activity player, shown with example content">
        <div className="stage-chrome">
          <span className="stage-dot" />
          <span className="mono stage-channel"># late-night</span>
          <span className="mono stage-listeners">4 listening</span>
        </div>

        <div className="stage-body">
          <div className="stage-left">
            <div className="stage-cover">
              <CoverArt art="tamagotchi" title="Tamagotchi" />
              <span className="stage-signal" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="stage-id">
              <b>Tamagotchi</b>
              <small>TACONAFIDE</small>
              <span className="qsub">
                <span className="srctag">Deezer</span>
                <span className="srctag">FLAC</span>
              </span>
            </div>

            <div className="stage-seek">
              <span className="stage-track">
                <span className="stage-played" />
              </span>
              <span className="stage-times mono">
                <span>1:14</span>
                <span>3:25</span>
              </span>
            </div>

            <div className="stage-transport">
              <button type="button" className="stage-ico" tabIndex={-1} aria-hidden="true">
                <Shuffle size={17} />
              </button>
              <button type="button" className="stage-ico" tabIndex={-1} aria-hidden="true">
                <SkipBack size={18} weight="fill" />
              </button>
              <button type="button" className="stage-play" tabIndex={-1} aria-hidden="true">
                <Pause size={18} weight="fill" />
              </button>
              <button type="button" className="stage-ico" tabIndex={-1} aria-hidden="true">
                <SkipForward size={18} weight="fill" />
              </button>
              <button type="button" className="stage-ico" tabIndex={-1} aria-hidden="true">
                <Repeat size={17} />
              </button>

              <span className="stage-spacer" />

              <button type="button" className="stage-ico is-liked" tabIndex={-1} aria-hidden="true">
                <Heart size={17} weight="fill" />
              </button>
              <button type="button" className="stage-ico" tabIndex={-1} aria-hidden="true">
                <SpeakerHigh size={17} />
              </button>
              <span className="stage-vol">
                <span />
              </span>
            </div>
          </div>

          <div className="stage-queue">
            <div className="stage-queue-head mono">Up next</div>
            {QUEUE.map((track) => (
              <div className="qrow" key={track.title}>
                <CoverArt art={track.art} title={track.title} />
                <span className="qmeta">
                  <b>{track.title}</b>
                  <small>{track.artist}</small>
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
        </div>
      </div>

      <p className="stage-note">Example session. Artwork is drawn for this page.</p>
    </section>
  );
}
