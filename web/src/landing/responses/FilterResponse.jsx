import { useState } from "react";
import { Faders } from "@phosphor-icons/react";

/* The thirteen presets in FILTER_PRESET_NAMES, with the descriptions the
   Activity shows beside each one. */
const FILTERS = [
  ["Nightcore", "Faster, brighter, and slightly higher pitch"],
  ["Vaporwave", "Slow, dreamy, and lower-pitched"],
  ["Chipmunk", "High-pitched meme mode"],
  ["Deep Voice", "Lower pitch for a darker voice"],
  ["8D", "Slow stereo rotation for an 8D effect"],
  ["Karaoke", "Reduces center-panned vocals"],
  ["Wobble", "Adds a playful tremolo wobble"],
  ["Vibrato", "Adds a noticeable vocal vibrato"],
  ["Robot", "Crunchy robotic distortion"],
  ["Telephone", "Narrow, filtered telephone sound"],
  ["Mono", "Folds stereo into a centered mono mix"],
  ["Surround", "Gentle rotating surround feel"],
  ["Meme", "Fast pitch plus wobble for cursed moments"],
];

export default function FilterResponse() {
  const [active, setActive] = useState("Nightcore");

  return (
    <div>
      <div className="find">
        <span className="find-ico">
          <Faders size={17} />
        </span>
        <span>
          <b>Shape the sound</b>
          <small>EQ and playful filters are applied to the live player</small>
        </span>
      </div>

      <div className="filters">
        {FILTERS.map(([name, detail]) => (
          <button
            type="button"
            key={name}
            className={active === name ? "ftile is-on" : "ftile"}
            onClick={() => setActive(active === name ? null : name)}
          >
            <b>{name}</b>
            <small>{detail}</small>
          </button>
        ))}
      </div>

      {/* Below 520px the tile descriptions are hidden — thirteen four-line
          tiles made this the tallest response on the page, and the canvas is
          sized by its tallest member. The description for the selected filter
          comes back here instead, so nothing is actually lost. */}
      <p className="filters-active">
        {active ? FILTERS.find(([name]) => name === active)?.[1] : "Tap a filter to read what it does."}
      </p>

      <p className="resp-foot mono">One click each, applied by Lavalink without reloading the track. They stack on top of the equalizer.</p>
    </div>
  );
}
