import { useState } from "react";
import { SettingsMenu } from "../SettingsMenu";
import { useKnit } from "./KnitContext";
import { PANEL_IDS, PANELS, type PanelId } from "./layout";
import { PANEL_COMPONENTS } from "./panelComponents";
import { StepButtons } from "./StepButtons";
import { useSwipe } from "./useSwipe";

const TAB_KEY = "knit-phone-tab";

const readTab = (): PanelId => {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return PANEL_IDS.find((id) => id === saved) ?? "instructions";
  } catch {
    return "instructions";
  }
};

/**
 * Phone: one panel at a time, picked from a tab bar at the bottom, with the
 * step buttons just above it where a thumb reaches. Swipe the instructions
 * sideways to move between steps.
 */
export function PhoneLayout({ onExit }: { onExit: () => void }) {
  const { project, steps, index, step, next, prev } = useKnit();
  const [tab, setTab] = useState<PanelId>(readTab);
  const choose = (id: PanelId) => {
    setTab(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      // Storage unavailable: the tab just isn't remembered.
    }
  };
  const swipe = useSwipe(next, prev);
  const Panel = PANEL_COMPONENTS[tab];
  const done = steps.length ? (index + 1) / steps.length : 0;

  return (
    <div className="knit phone">
      <header className="phone-bar">
        <button className="quiet" onClick={onExit} aria-label="Projects">
          ←
        </button>
        <div className="phone-title">
          <b>{project.name}</b>
          <span className="muted">
            {step?.section.title} · {index + 1}/{steps.length}
          </span>
        </div>
        <SettingsMenu />
        <div className="knit-progress-track phone-progress">
          <div style={{ width: `${done * 100}%` }} />
        </div>
      </header>
      <main className="phone-panel" {...(tab === "instructions" ? swipe : {})}>
        <Panel />
      </main>
      <footer className="phone-footer">
        <StepButtons />
        <nav className="phone-tabs">
          {PANEL_IDS.map((id) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => choose(id)}>
              {PANELS[id]}
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}
