import { useState } from "react";

/* Band frequencies match the ten preset bands in helpers/lavalink/constants.js. */
const FREQS = ["25", "40", "63", "100", "160", "250", "400", "630", "1k", "1.6k"];

const PRESETS = {
  bassboost: [5, 4.5, 3.5, 2, 0.5, -0.5, -1, -0.5, 0.5, 1.5],
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  vocal: [-2, -1.5, -0.5, 1, 2.5, 3.5, 3, 2, 1, 0.5],
  nightcore: [2, 1.5, 0.5, -0.5, -1, 0.5, 2, 3.5, 4.5, 5],
  lofi: [3, 2.5, 1.5, 0.5, -1, -2.5, -3.5, -4, -4.5, -5],
};

const RANGE = 6;

export default function EqResponse() {
  const [preset, setPreset] = useState("bassboost");
  const [gains, setGains] = useState(PRESETS.bassboost);
  const [dragging, setDragging] = useState(null);

  function applyPreset(name) {
    setPreset(name);
    setGains(PRESETS[name]);
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
        Twenty-two presets across the ten equalizer bands, custom presets saved per user, and filter
        presets that stack on top. Drag a band — this one is live.
      </p>

      <div className="eq">
        {FREQS.map((hz, index) => {
          const db = gains[index];
          const scale = (db + RANGE) / (RANGE * 2);

          return (
            <div className="eq-band" key={hz}>
              <span className="mono eq-db">{db > 0 ? `+${db}` : db}</span>

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
              >
                <span className="eq-fill" style={{ transform: `scaleY(${scale})` }} />
                <span className="eq-zero" />
              </div>

              <input
                className="visually-hidden"
                type="range"
                min={-RANGE}
                max={RANGE}
                step={0.5}
                value={db}
                onChange={(event) => setBand(index, Number(event.target.value))}
                aria-label={`${hz} hertz band, ${db} decibels`}
              />

              <span className="mono eq-hz">{hz}</span>
            </div>
          );
        })}
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
        <span className="eq-more mono">{preset === "custom" ? "custom" : "+17 more"}</span>
      </div>
      <p className="resp-foot mono">Changes apply to the live player straight away, and your own presets are saved per user.</p>
    </div>
  );
}
