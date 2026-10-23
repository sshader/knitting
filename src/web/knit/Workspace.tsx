import { DockviewDefaultTab, DockviewReact, themeLightSpaced, type DockviewApi, type IDockviewPanelHeaderProps, type IDockviewPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { useCallback, useMemo, useRef, type FunctionComponent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { KnitContext, type Knit } from "./KnitContext";
import { defaultLayout, restoreLayout, saveLayout } from "./layout";
import { ChartPanel } from "./panels/ChartPanel";
import { InstructionsPanel } from "./panels/InstructionsPanel";
import { PdfPanel } from "./panels/PdfPanel";
import { StepsPanel } from "./panels/StepsPanel";
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

/** Panels are rearranged, not closed: a closed panel could only come back via Reset layout. */
const Tab = (props: IDockviewPanelHeaderProps) => <DockviewDefaultTab {...props} hideClose />;

/** Knitting a project: the top bar, and the panels in a layout the knitter can rearrange. */
export function Workspace({ projectId, onExit }: { projectId: Id<"projects">; onExit: () => void }) {
  const { project, move } = useProject(projectId);
  const data = useKnitData(project);
  const dock = useRef<DockviewApi | null>(null);

  const steps = data?.steps;
  const index = project && steps ? resolveStep(steps, project.position) : 0;
  const go = useCallback(
    (i: number) => {
      if (!steps?.length) return;
      const step = Math.min(Math.max(0, i), steps.length - 1);
      move({ step, node: steps[step].node });
    },
    [steps, move],
  );
  useStepKeys(index, go);

  const knit: Knit | null = useMemo(
    () => (project && data ? { ...data, project, index, step: data.steps[index], go } : null),
    [project, data, index, go],
  );

  if (project === null) return <div className="panel-empty">This project doesn't exist any more.</div>;
  if (!knit) return <div className="panel-empty">Loading…</div>;

  return (
    <KnitContext.Provider value={knit}>
      <div className="knit">
        <TopBar onExit={onExit} onResetLayout={() => dock.current && defaultLayout(dock.current)} />
        <DockviewReact
          className="knit-dock"
          theme={themeLightSpaced}
          components={COMPONENTS}
          defaultTabComponent={Tab}
          disableFloatingGroups
          onReady={({ api }) => {
            dock.current = api;
            restoreLayout(api);
            api.onDidLayoutChange(() => saveLayout(api));
          }}
        />
      </div>
    </KnitContext.Provider>
  );
}
