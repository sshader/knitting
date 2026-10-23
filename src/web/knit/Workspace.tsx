import { DockviewReact, themeLightSpaced, type DockviewApi, type IDockviewPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { useMemo, useRef, useState, type FunctionComponent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { KnitContext, type Knit } from "./KnitContext";
import { defaultLayout, hidePanel, PANEL_IDS, restoreLayout, saveLayout, showPanel, type PanelId } from "./layout";
import { MaximizeButton } from "./MaximizeButton";
import { ChartPanel } from "./panels/ChartPanel";
import { InstructionsPanel } from "./panels/InstructionsPanel";
import { PdfPanel } from "./panels/PdfPanel";
import { StepsPanel } from "./panels/StepsPanel";
import * as nav from "./navigation";
import { resolveStep } from "./steps";
import { TopBar } from "./TopBar";
import { useKnitData } from "./useKnitData";
import { useProject } from "./useProject";
import { useStepKeys } from "./useStepKeys";

const COMPONENTS: Record<string, FunctionComponent<IDockviewPanelProps>> = {
  instructions: InstructionsPanel,
  steps: StepsPanel,
  chart: ChartPanel,
  pdf: PdfPanel,
};

/** Knitting a project: the top bar, and the panels in a layout the knitter can rearrange. */
export function Workspace({ projectId, onExit }: { projectId: Id<"projects">; onExit: () => void }) {
  const { project, move } = useProject(projectId);
  const data = useKnitData(project);
  const dock = useRef<DockviewApi | null>(null);
  const [open, setOpen] = useState(new Set<PanelId>());
  const togglePanel = (id: PanelId) => {
    const api = dock.current;
    if (!api) return;
    if (open.has(id)) hidePanel(api, id);
    else showPanel(api, id);
  };

  const knit: Knit | null = useMemo(() => {
    if (!project || !data) return null;
    const { steps } = data;
    const index = resolveStep(steps, project.position);
    const position = { ...project.position, step: index };
    const moveIf = (to: nav.Position) => steps.length && move(to);
    return {
      ...data,
      project,
      position,
      index,
      step: steps[index],
      go: (i) => moveIf(nav.moveTo(steps, position, i)),
      next: () => moveIf(nav.next(steps, position)),
      prev: () => moveIf(nav.prev(steps, position)),
      finishRepeat: () => moveIf(nav.finishRepeat(steps, position)),
      setMark: (mark) => move({ ...position, mark }),
    };
  }, [project, data, move]);
  useStepKeys(knit);

  if (project === null) return <div className="panel-empty">This project doesn't exist any more.</div>;
  if (!knit) return <div className="panel-empty">Loading…</div>;

  return (
    <KnitContext.Provider value={knit}>
      <div className="knit">
        <TopBar
          onExit={onExit}
          panels={{
            open,
            onToggle: togglePanel,
            onReset: () => dock.current && defaultLayout(dock.current),
          }}
        />
        <DockviewReact
          className="knit-dock"
          theme={themeLightSpaced}
          components={COMPONENTS}
          rightHeaderActionsComponent={MaximizeButton}
          disableFloatingGroups
          onReady={({ api }) => {
            dock.current = api;
            restoreLayout(api);
            const track = () => setOpen(new Set(PANEL_IDS.filter((id) => api.getPanel(id))));
            track();
            api.onDidLayoutChange(() => {
              saveLayout(api);
              track();
            });
          }}
        />
      </div>
    </KnitContext.Provider>
  );
}
