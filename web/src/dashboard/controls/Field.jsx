import { Check } from "@phosphor-icons/react";

/**
 * Every control states what it changes in the bot's own terms, carries its
 * consequence inline, and shows the save landing on the field itself.
 */
export default function Field({ label, describe, note, tone = "muted", saved, children }) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        {saved ? (
          <span className="field-saved" role="status">
            <Check size={12} weight="bold" />
            Saved
          </span>
        ) : null}
      </div>

      <div className="field-control">{children}</div>

      <p className="field-describe">{describe}</p>
      {note ? <p className={`field-note is-${tone}`}>{note}</p> : null}
    </div>
  );
}
