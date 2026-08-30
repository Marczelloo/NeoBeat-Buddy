import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ActivityGate from "./views/ActivityGate.jsx";
import "./styles.css";

/* A Discord Activity always runs inside Discord's iframe, so `self === top` is
   proof — not a guess — that this is not one. The check is deliberately made
   here rather than inside App: gating on the URL anywhere Discord can reach
   would risk blanking the Activity for everyone if Discord ever served it from
   a path other than the root. Outside the iframe there is nothing to break.
   Development keeps the standalone preview, which is the whole point of it. */
const embedded = window.self !== window.top;
const standalone = !import.meta.env.DEV && !embedded;
const isRoot = ["/", "/index.html"].includes(window.location.pathname);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {standalone ? (
      <ActivityGate variant={isRoot ? "outside" : "notfound"} path={window.location.pathname} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
