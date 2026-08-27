import { motion, useReducedMotion } from "motion/react";

/**
 * A single restrained reveal, used only in the ledger. The page's authored
 * motion is the command line and its canvas; repeating an entrance on every
 * section would dilute it.
 *
 * Motion animates via JS, so the stylesheet's prefers-reduced-motion block
 * cannot reach it. useReducedMotion drops the animation entirely instead.
 */
export default function Reveal({ children, delay = 0, className }) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.26, delay, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
