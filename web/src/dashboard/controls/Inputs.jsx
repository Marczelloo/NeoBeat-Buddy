export function Toggle({ checked, onChange, disabled, onLabel = "On", offLabel = "Off" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={checked ? "toggle is-on" : "toggle"}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      <span className="toggle-text">{checked ? onLabel : offLabel}</span>
    </button>
  );
}

export function Select({ value, onChange, disabled, options, placeholder, id }) {
  return (
    <select
      id={id}
      className="select"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Slider({ value, onChange, disabled, min, max, step, format, id }) {
  return (
    <div className="slider">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output className="mono slider-value">{format(value)}</output>
    </div>
  );
}

/**
 * A set of independent on/off rows. Used where several things are configured
 * at once and a select would hide the ones that are off — log categories are
 * four separate switches, not one choice.
 */
export function ToggleRows({ rows, onChange, disabled }) {
  return (
    <div className="rows">
      {rows.map((row) => (
        <div key={row.id} className={row.disabled || disabled ? "row is-off" : "row"}>
          <span className="row-text">
            <b>{row.label}</b>
            <small>{row.describe}</small>
          </span>
          <Toggle
            checked={row.checked}
            disabled={row.disabled || disabled}
            onChange={(value) => onChange(row.id, value)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Multi-select over roles. Every change is one grant or one revoke, matching
 * `/logs access`, because each one edits Discord permissions on the way
 * through — a bulk apply would leave no way to report which role failed.
 */
export function RoleChecklist({ selected, options, onToggle, disabled, empty }) {
  if (options.length === 0) return <p className="checklist-empty">{empty}</p>;

  return (
    <div className="checklist">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            type="button"
            key={option.value}
            role="checkbox"
            aria-checked={on}
            disabled={disabled}
            className={on ? "chip is-on" : "chip"}
            onClick={() => onToggle(option.value, !on)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The fifteen Lavalink equalizer bands.
 *
 * The dB label mirrors `formatGainValue` in helpers/equalizer/panel.js so the
 * dashboard and `/eqpanel` describe the same gain identically. The asymmetry
 * is Lavalink's, not a mistake: a cut reaches much further than a boost.
 */
export function BandSliders({ bands, frequencies, minGain, maxGain, onChange, onCommit, disabled }) {
  const toDb = (gain) => (gain >= 0 ? gain * 6 : gain * 48);

  return (
    <div className="bands">
      {bands.map((gain, index) => (
        <label className="band" key={frequencies[index] || index}>
          <span className="mono band-freq">{frequencies[index] || `Band ${index + 1}`}</span>
          <input
            className="band-input"
            type="range"
            min={minGain}
            max={maxGain}
            step={0.01}
            value={gain}
            disabled={disabled}
            aria-label={`${frequencies[index] || `Band ${index + 1}`} gain`}
            onChange={(event) => onChange(index, Number(event.target.value))}
            // Dragging fires change continuously; only the release is worth a
            // request, and a Lavalink filter update per pixel would be abuse.
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
          <output className={gain === 0 ? "mono band-value" : "mono band-value is-set"}>
            {`${toDb(gain) >= 0 ? "+" : ""}${toDb(gain).toFixed(1)} dB`}
          </output>
        </label>
      ))}
    </div>
  );
}
