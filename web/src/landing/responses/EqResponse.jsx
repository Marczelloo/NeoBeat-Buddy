import { useState } from "react";

/* The real 15-band set from BAND_FREQUENCIES in helpers/equalizer/panel.js. */
const FREQS = [
  "25", "40", "63", "100", "160", "250", "400", "630",
  "1k", "1.6k", "2.5k", "4k", "6.3k", "10k", "16k",
];

/* Gains lifted from EQUALIZER_PRESETS in helpers/lavalink/constants.js,
   expanded across all fifteen bands. */
const PRESETS = {
  bassboost: [0.5, 0.45, 0.35, 0.25, 0.15, 0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  vocal: [-0.18, -0.15, -0.1, 0.05, 0.12, 0.18, 0.22, 0.25, 0.18, 0.12, 0.08, 0, 0, 0, 0],
  nightcore: [0.1, 0.08, 0.05, 0, 0, 0, 0, 0.12, 0.15, 0.18, 0.2, 0.22, 0.18, 0, 0],
  lofi: [0.15, 0.12, 0.08, 0.05, 0, -0.15, -0.2, -0.15, -0.1, 0, 0.08, 0, -0.12, -0.15, -0.18],
  flat: Array(15).fill(0),
};

const SCALE = 12;
const RANGE = 6;

const toDb = (gain) => Math.round(gain * SCALE * 2) / 2;
const signed = (db) => (db > 0 ? `+${db}` : `${db}`);

export default function EqResponse() {
  const [preset, setPreset] = useState("bassboost");
  const [gains, setGains] = useState(PRESETS.bassboost.map(toDb));
  const [dragging, setDragging] = useState(null);
  const [hovered, setHovered] = useState(null);

  function applyPreset(name) {
    setPreset(name);
    setGains(PRESETS[name].map(toDb));
  }

  function setBand(index, value) {
    const next = [...gains];
    next[index] = Math.max(-RANGE, Math.min(RANGE, value));
    setGains(next);
    setPreset("custom");
  }

  function pointerToGain(event, element) {
    const rect = element.getBoundingClientRect();
    const ratio = 1 - (event.clientY - rect.top) / rect.height;
    return Math.round((ratio * RANGE * 2 - RANGE) * 2) / 2;
  }

  return (
    <div>
      <p className="resp-lead">
        Fifteen bands from 25 Hz to 16 kHz, twenty-two presets, and custom presets saved per user.
        Grab a handle — this one is live.
      </p>

      <div className="eq">
        {/* The scale is what makes the sliders mean something: without it a
            handle is a decoration, with it the same handle is −4.5 dB. */}
        <div className="eq-scale" aria-hidden="true">
          <span className="mono">+{RANGE}</span>
          <span className="mono">0</span>
          <span className="mono">−{RANGE}</span>
        </div>

        <div className="eq-bands">
          {FREQS.map((hz, index) => {
            const db = gains[index];
            const scale = (db + RANGE) / (RANGE * 2);
            const busy = dragging === index || hovered === index;

            return (
              <div className="eq-band" key={hz}>
                <div
                  className={dragging === index ? "eq-track is-dragging" : "eq-track"}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(index);
                    setBand(index, pointerToGain(event, event.currentTarget));
                  }}
                  onPointerMove={(event) => {
                    if (dragging !== index) return;
                    setBand(index, pointerToGain(event, event.currentTarget));
                  }}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                  onPointerEnter={() => setHovered(index)}
                  onPointerLeave={() => setHovered((current) => (current === index ? null : current))}
                >
                  {/* Bipolar: the fill runs from the 0 dB line to the handle, so
                      a cut reads as a cut instead of as a shorter boost. */}
                  <span
                    className={db < 0 ? "eq-fill is-cut" : "eq-fill"}
                    style={{ height: `${Math.abs(scale - 0.5) * 100}%` }}
                  />
                  <span className="eq-zero" />
                  <span className="eq-thumb" style={{ bottom: `${scale * 100}%` }} />
                  <span className={busy ? "mono eq-read is-on" : "mono eq-read"}>{signed(db)}</span>
                </div>

                <input
                  className="visually-hidden"
                  type="range"
                  min={-RANGE}
                  max={RANGE}
                  step={0.5}
                  value={db}
                  onChange={(event) => setBand(index, Number(event.target.value))}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered((current) => (current === index ? null : current))}
                  aria-label={`${hz} hertz band, ${db} decibels`}
                />

                <span className="mono eq-hz">{hz}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="eq-presets">
        {Object.keys(PRESETS).map((name) => (
          <button
            type="button"
            key={name}
            className={preset === name ? "mode is-on" : "mode"}
            onClick={() => applyPreset(name)}
          >
            {name}
          </button>
        ))}
        <span className="eq-more mono">{preset === "custom" ? "custom" : "+18 more"}</span>
      </div>
      <p className="resp-foot mono">Changes apply to the live player straight away, and your own presets are saved per user.</p>
    </div>
  );
}
