import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TriageInspector } from "./inspector/TriageInspector";
import "./inspector/inspector.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TriageInspector />
  </StrictMode>,
);
