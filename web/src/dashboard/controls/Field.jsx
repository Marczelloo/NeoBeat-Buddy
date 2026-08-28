import { Check } from "@phosphor-icons/react";

/**
 * Every control states what it changes in the bot's own terms, carries its
 * consequence inline, and shows the save landing on the field itself.
 *
 * `wide` drops the two-column layout and lets the control run the full width.
 * A row of fifteen equalizer bands or four category switches has no business
 * inside the 320px gutter a select sits in.
 */
export default function Field({ label, describe, note, tone = "muted", saved, wide, children }) {
  return (
    <div className={wide ? "field is-wide" : "field"}>
      <div className="field-label">
        <span>{label}</span>
        {saved ? (
          <span className="field-saved" role="status">
            <Check size={12} weight="bold" />
            Saved
          </span>
        ) : null}
      </div>

      <p className="field-describe">{describe}</p>
      {note ? <p className={`field-note is-${tone}`}>{note}</p> : null}

      <div className="field-control">{children}</div>
    </div>
  );
}
