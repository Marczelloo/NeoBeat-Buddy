import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { installDevMock } from "./devMock.js";
import "./tokens.css";

installDevMock();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
