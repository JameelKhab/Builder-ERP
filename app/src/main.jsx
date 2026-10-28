import React from "react";
import { createRoot } from "react-dom/client";
import { SessionShell } from "./SessionShell.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(<React.StrictMode>
    <SessionShell />
  </React.StrictMode>);
