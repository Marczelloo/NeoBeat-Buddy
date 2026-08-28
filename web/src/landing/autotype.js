import { useEffect, useState } from "react";

/**
 * The command line types itself: a real command, a pause on the finished line,
 * then a backspace run, then the next one.
 *
 * The delays are jittered rather than fixed. A metronome reads as a marquee;
 * uneven keystrokes read as someone at a keyboard, which is the whole point of
 * a command surface. Unlike the hero geometry, this uses Math.random freely —
 * nothing about it is laid out, so there is nothing to keep stable between
 * renders.
 */

/* Every line is a command MewBit actually takes, with arguments it accepts:
   bassboost and nightcore are real presets, and the track is the one the /play
   response already shows. */
const SCRIPT = [
  { id: "play", text: "/play tame impala loser" },
  { id: "queue", text: "/queue" },
  { id: "dj", text: "/dj" },
  { id: "eq", text: "/equalizer bassboost" },
  { id: "filter", text: "/filter nightcore" },
];

const HOLD_MS = 3000;
const BETWEEN_MS = 460;
const OPENING_MS = 900;

function keyDelay(text, count) {
  const char = text[count - 1];
  let ms = 46 + Math.random() * 54;
  if (char === "/") ms += 90; // the slash is a decision, not a keystroke
  if (char === " ") ms += 46; // a beat before the argument
  if (Math.random() < 0.07) ms += 190; // an occasional hesitation
  return ms;
}

function backDelay(remaining) {
  let ms = 26 + Math.random() * 30;
  if (Math.random() < 0.1) ms += 95; // a hitch, so the run is not a metronome
  if (remaining < 4) ms += 26; // the last characters come off slower
  return ms;
}

const IDLE = { text: "", id: SCRIPT[0].id, typing: false, running: false };

export default function useAutotype(enabled) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!enabled) return undefined;
    /* Under reduced motion the hook never runs, and `running` stays false so
       the caller falls back to a static hint rather than an empty field. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let timer = 0;
    let cancelled = false;
    let step = 0;
    let count = 0;
    let phase = "typing";
    /* The canvas follows the finished line, not the first keystroke — the
       response should answer the command, not precede it. */
    let shown = SCRIPT[0].id;

    function tick() {
      if (cancelled) return;
      const entry = SCRIPT[step];
      let delay;

      if (phase === "typing") {
        count += 1;
        setState({ text: entry.text.slice(0, count), id: shown, typing: true, running: true });
        if (count >= entry.text.length) {
          phase = "holding";
          delay = 240;
        } else {
          delay = keyDelay(entry.text, count);
        }
      } else if (phase === "holding") {
        shown = entry.id;
        setState({ text: entry.text, id: shown, typing: false, running: true });
        phase = "deleting";
        delay = HOLD_MS;
      } else {
        count -= 1;
        setState({ text: entry.text.slice(0, count), id: shown, typing: true, running: true });
        if (count <= 0) {
          step = (step + 1) % SCRIPT.length;
          phase = "typing";
          delay = BETWEEN_MS;
        } else {
          delay = backDelay(count);
        }
      }

      timer = window.setTimeout(tick, delay);
    }

    timer = window.setTimeout(tick, OPENING_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return enabled ? state : IDLE;
}
