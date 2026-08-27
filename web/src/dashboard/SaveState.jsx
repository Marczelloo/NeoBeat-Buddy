import { Check, CircleNotch } from "@phosphor-icons/react";

/**
 * Writes land immediately, so there is no dirty state to confirm. The bar
 * reports what just reached the bot; the field itself carries the mark.
 */
export default function SaveState({ state }) {
  if (state === "idle") return null;

  return (
    <footer className="savebar" role="status" aria-live="polite">
      {state === "saving" ? (
        <>
          <CircleNotch size={14} weight="bold" className="spin" />
          Saving to the live bot…
        </>
      ) : (
        <>
          <Check size={14} weight="bold" />
          Saved. The bot is using this now.
        </>
      )}
    </footer>
  );
}
