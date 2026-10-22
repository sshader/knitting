import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChartsInspector } from "./inspector/ChartsInspector";
import { MapInspector } from "./inspector/MapInspector";
import { SectionsInspector } from "./inspector/SectionsInspector";
import { StepsPreview } from "./inspector/StepsPreview";
import { TriageInspector } from "./inspector/TriageInspector";
import "./inspector/inspector.css";

type View = "triage" | "map" | "sections" | "charts" | "steps";

function App() {
  const params = new URLSearchParams(location.search);
  const [view, setView] = useState<View>((["map", "sections", "charts", "steps"] as const).find((v) => v === params.get("view")) ?? "triage");
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
        <button className={view === "charts" ? "on" : ""} onClick={() => go("charts")}>
          3 · Charts
        </button>
        <button className={view === "steps" ? "on" : ""} onClick={() => go("steps")}>
          Steps preview
        </button>
      </nav>
      {view === "triage" ? (
        <TriageInspector />
      ) : view === "map" ? (
        <MapInspector initial={params.get("p")} onSelect={onSelectPattern} />
      ) : view === "sections" ? (
        <SectionsInspector initial={params.get("p")} onSelect={onSelectPattern} />
      ) : view === "charts" ? (
        <ChartsInspector />
      ) : (
        <StepsPreview />
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
