import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapInspector } from "./inspector/MapInspector";
import { TriageInspector } from "./inspector/TriageInspector";
import "./inspector/inspector.css";

type View = "triage" | "map";

function App() {
  const params = new URLSearchParams(location.search);
  const [view, setView] = useState<View>(params.get("view") === "map" ? "map" : "triage");
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
      </nav>
      {view === "triage" ? <TriageInspector /> : <MapInspector initial={params.get("p")} onSelect={onSelectPattern} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
