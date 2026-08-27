import { Check, CircleNotch } from "@phosphor-icons/react";

/**
 * Writes land immediately, so there is no dirty state to confirm. The bar
 * reports what reached the bot; the field itself carries the mark. It has a
 * resting line so the foot of the column always says where changes go.
 */
export default function SaveState({ state, guildName }) {
  if (state === "saving") {
    return (
      <footer className="savebar" role="status" aria-live="polite">
        <CircleNotch size={14} weight="bold" className="spin" />
        Saving to the live bot…
      </footer>
    );
  }

  if (state === "saved") {
    return (
      <footer className="savebar" role="status" aria-live="polite">
        <Check size={14} weight="bold" />
        Saved. The bot is using this now.
      </footer>
    );
  }

  return (
    <footer className="savebar is-resting">
      Changes save as you make them.
      {guildName ? <span className="savebar-guild">{guildName}</span> : null}
    </footer>
  );
}
