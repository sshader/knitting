import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useState } from "react";
import { ChartsInspector } from "./inspector/charts/ChartsInspector";
import { MapInspector } from "./inspector/map/MapInspector";
import { SectionsInspector } from "./inspector/sections/SectionsInspector";
import { StepsPreview } from "./inspector/steps/StepsPreview";
import { TriageInspector } from "./inspector/triage/TriageInspector";
import { SignIn } from "./SignIn";

const VIEWS = {
  triage: { label: "0 · Triage", Component: TriageInspector },
  map: { label: "1 · Document map", Component: MapInspector },
  sections: { label: "2 · Sections", Component: SectionsInspector },
  charts: { label: "3 · Charts", Component: ChartsInspector },
  steps: { label: "Steps preview", Component: StepsPreview },
};
type View = keyof typeof VIEWS;

const isView = (v: string | null): v is View => v !== null && v in VIEWS;

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
        <Inspector />
      </Authenticated>
    </>
  );
}

function Inspector() {
  const { signOut } = useAuthActions();
  const [view, setView] = useState<View>(() => {
    const v = new URLSearchParams(location.search).get("view");
    return isView(v) ? v : "triage";
  });
  const go = (v: View) => {
    const params = new URLSearchParams(location.search);
    params.set("view", v);
    history.replaceState(null, "", `?${params}`);
    setView(v);
  };
  const { Component } = VIEWS[view];
  return (
    <>
      <nav className="tabs">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => go(v)}>
            {VIEWS[v].label}
          </button>
        ))}
        <button className="sign-out" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
      <Component />
    </>
  );
}
