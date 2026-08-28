import { COMMANDS } from "./commands.js";

/**
 * Every response is mounted and stacked in one grid cell, so the canvas is
 * always as tall as the tallest response and never reflows when you switch
 * commands. Hovering a command index row must not move that row out from
 * under the cursor — a swap that resizes the page makes the list unusable.
 */
export default function ResponseCanvas({ commandId }) {
  return (
    <div className="canvas-slot">
      <div className="canvas">
        {COMMANDS.map((command) => {
          const active = command.id === commandId;
          const Response = command.Response;

          return (
            <div
              key={command.id}
              className={active ? "canvas-layer is-on" : "canvas-layer"}
              aria-hidden={!active}
              inert={!active}
            >
              <div className="canvas-head">
                <span className="canvas-sig">{command.signature}</span>
                <span className="canvas-note">{command.note}</span>
              </div>
              <Response active={active} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
