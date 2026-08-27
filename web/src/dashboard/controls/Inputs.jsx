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
