import { SettingsMenu } from "../SettingsMenu";
import { useKnit } from "./KnitContext";
import type { PanelId } from "./layout";
import { PanelsSection } from "./PanelsSection";
import { StepButtons } from "./StepButtons";
import { setupLabel } from "./setupLabel";

/** Laptop: project, size, how far along, the step buttons, and settings. */
export function TopBar({
  onExit,
  panels,
}: {
  onExit: () => void;
  panels: { open: Set<PanelId>; onToggle: (id: PanelId) => void; onReset: () => void };
}) {
  const { project, map, steps, index, step } = useKnit();
  const done = steps.length ? (index + 1) / steps.length : 0;
  return (
    <header className="knit-bar">
      <button className="quiet" onClick={onExit}>
        ← Projects
      </button>
      <div className="knit-title">
        <b>{project.name}</b>
        <span className="muted">{setupLabel(map, project)}</span>
      </div>
      <div className="knit-progress" title={`${Math.round(done * 100)}% through the pattern`}>
        <div className="knit-progress-text">
          <span>{step?.section.title}</span>
          <span className="muted">
            Step {index + 1} of {steps.length}
          </span>
        </div>
        <div className="knit-progress-track">
          <div style={{ width: `${done * 100}%` }} />
        </div>
      </div>
      <StepButtons />
      <SettingsMenu>{(close) => <PanelsSection {...panels} close={close} />}</SettingsMenu>
    </header>
  );
}
