import { motion } from "motion/react";
import { findCommand } from "./commands.js";

export default function ResponseCanvas({ commandId }) {
  const command = findCommand(commandId);
  const Response = command.Response;

  return (
    <div className="canvas-slot">
      {/* Keyed remount: the new response fades and rises in. No exit phase, so
          the swap costs one 240ms beat rather than two. */}
      <motion.div
        key={command.id}
        className="canvas"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="canvas-head">
          <span className="canvas-sig">{command.signature}</span>
          <span className="canvas-note">{command.note}</span>
        </div>
        <Response />
      </motion.div>
    </div>
  );
}
