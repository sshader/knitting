import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapInspector } from "./inspector/MapInspector";
import { SectionsInspector } from "./inspector/SectionsInspector";
import { TriageInspector } from "./inspector/TriageInspector";
import "./inspector/inspector.css";

type View = "triage" | "map" | "sections";

function App() {
  const params = new URLSearchParams(location.search);
  const [view, setView] = useState<View>((["map", "sections"] as const).find((v) => v === params.get("view")) ?? "triage");
  const go = (v: View) => {
    const next = new URLSearchParams({ view: v });
    history.replaceState(null, "", `?${next}`);
    setView(v);
  };
  const onSelectPattern = useCallback((p: string) => {
    const next = new URLSearchParams(location.search);
    next.set("p", p);
    history.replaceState(null, "", `?${next}`);
  }, []);
  return (
    <>
      <nav className="tabs">
        <button className={view === "triage" ? "on" : ""} onClick={() => go("triage")}>
          0 · Triage
        </button>
        <button className={view === "map" ? "on" : ""} onClick={() => go("map")}>
          1 · Document map
        </button>
        <button className={view === "sections" ? "on" : ""} onClick={() => go("sections")}>
          2 · Sections
        </button>
      </nav>
      {view === "triage" ? (
        <TriageInspector />
      ) : view === "map" ? (
        <MapInspector initial={params.get("p")} onSelect={onSelectPattern} />
      ) : (
        <SectionsInspector initial={params.get("p")} onSelect={onSelectPattern} />
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
