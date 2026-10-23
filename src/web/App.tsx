import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { lazy, Suspense, useState } from "react";
import { KnitView } from "./knit/KnitView";
import { ModeContext, type Mode } from "./mode";
import { SettingsMenu } from "./SettingsMenu";
import { SignIn } from "./SignIn";

// Pattern extraction mode is loaded only when it's opened, so knitting (on a phone especially) doesn't download it.
const TriageInspector = lazy(() => import("./inspector/triage/TriageInspector").then((m) => ({ default: m.TriageInspector })));
const MapInspector = lazy(() => import("./inspector/map/MapInspector").then((m) => ({ default: m.MapInspector })));
const SectionsInspector = lazy(() => import("./inspector/sections/SectionsInspector").then((m) => ({ default: m.SectionsInspector })));
const ChartsInspector = lazy(() => import("./inspector/charts/ChartsInspector").then((m) => ({ default: m.ChartsInspector })));
const StepsPreview = lazy(() => import("./inspector/steps/StepsPreview").then((m) => ({ default: m.StepsPreview })));

/** The inspector's stages, shown in pattern extraction mode. */
const STAGES = {
  triage: { label: "0 · Triage", Component: TriageInspector },
  map: { label: "1 · Document map", Component: MapInspector },
  sections: { label: "2 · Sections", Component: SectionsInspector },
  charts: { label: "3 · Charts", Component: ChartsInspector },
  steps: { label: "Steps preview", Component: StepsPreview },
};
type Stage = keyof typeof STAGES;
/** ?view=knit, or one of the stages. */
type View = "knit" | Stage;

const isView = (v: string | null): v is View => v === "knit" || (v !== null && v in STAGES);

export function App() {
  return (
    <>
      <AuthLoading>
        <p className="muted centered">Loading…</p>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <SignedIn />
      </Authenticated>
    </>
  );
}

function SignedIn() {
  const [view, setView] = useState<View>(() => {
    const v = new URLSearchParams(location.search).get("view");
    return isView(v) ? v : "knit";
  });
  const go = (v: View) => {
    const params = new URLSearchParams(location.search);
    params.set("view", v);
    history.replaceState(null, "", `?${params}`);
    setView(v);
  };
  const mode: Mode = view === "knit" ? "knit" : "extract";
  const setMode = (m: Mode) => go(m === "knit" ? "knit" : "triage");

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {view === "knit" ? <KnitView /> : <Extraction stage={view} onStage={go} />}
    </ModeContext.Provider>
  );
}

function Extraction({ stage, onStage }: { stage: Stage; onStage: (s: Stage) => void }) {
  const { Component } = STAGES[stage];
  return (
    <>
      <nav className="tabs">
        {(Object.keys(STAGES) as Stage[]).map((s) => (
          <button key={s} className={stage === s ? "on" : ""} onClick={() => onStage(s)}>
            {STAGES[s].label}
          </button>
        ))}
        <span className="tabs-end">
          <SettingsMenu />
        </span>
      </nav>
      <Suspense fallback={<p className="muted centered">Loading…</p>}>
        <Component />
      </Suspense>
    </>
  );
}
