import { lazy, Suspense, useMemo } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { KnitContext, type Knit } from "./KnitContext";
import * as nav from "./navigation";
import { PhoneLayout } from "./PhoneLayout";
import { resolveStep } from "./steps";
import { useIsPhone } from "./useIsPhone";
import { useKnitData } from "./useKnitData";
import { useProject } from "./useProject";
import { useStepKeys } from "./useStepKeys";
import { useWakeLock } from "./useWakeLock";

// Dockview (the laptop layout) is only downloaded on screens that use it.
const DockLayout = lazy(() => import("./DockLayout").then((m) => ({ default: m.DockLayout })));

/** Knitting a project: where you are and how to move, shown as panels (laptop) or one panel at a time (phone). */
export function Workspace({ projectId, onExit }: { projectId: Id<"projects">; onExit: () => void }) {
  const { project, move } = useProject(projectId);
  const data = useKnitData(project);
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
  useWakeLock();
  const phone = useIsPhone();

  if (project === null) return <div className="panel-empty">This project doesn't exist any more.</div>;
  if (!knit) return <div className="panel-empty">Loading…</div>;

  return (
    <KnitContext.Provider value={knit}>
      {phone ? (
        <PhoneLayout onExit={onExit} />
      ) : (
        <Suspense fallback={<div className="panel-empty">Loading…</div>}>
          <DockLayout onExit={onExit} />
        </Suspense>
      )}
    </KnitContext.Provider>
  );
}
