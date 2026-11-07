import { lazy, Suspense, useMemo, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ExpandedStep } from "../../shared/expand";
import { KnitContext, type Knit } from "./KnitContext";
import * as nav from "./navigation";
import { PhoneLayout } from "./PhoneLayout";
import { resolveStep } from "./steps";
import { TapNotice } from "./TapNotice";
import { useIsPhone } from "./useIsPhone";
import { useKnitData } from "./useKnitData";
import { useProject } from "./useProject";
import { useStepKeys } from "./useStepKeys";
import { useTapGuard } from "./useTapGuard";
import { useWakeLock } from "./useWakeLock";

// Dockview (the laptop layout) is only downloaded on screens that use it.
const DockLayout = lazy(() => import("./DockLayout").then((m) => ({ default: m.DockLayout })));

/** Knitting a project: where you are and how to move, shown as panels (laptop) or one panel at a time (phone). */
export function Workspace({ projectId, onExit }: { projectId: Id<"projects">; onExit: () => void }) {
  const { project, move } = useProject(projectId);
  const data = useKnitData(project);
  // The step being read ahead (or back) to; null when showing the place.
  const [reading, setReading] = useState<number | null>(null);
  const { tap, held } = useTapGuard();
  const knit: Knit | null = useMemo(() => {
    if (!project || !data) return null;
    const { steps } = data;
    const clamp = (i: number) => Math.max(0, Math.min(i, steps.length - 1));
    const place = resolveStep(steps, project.position);
    const here: nav.Place = { position: { ...project.position, step: place }, repeats: project.repeats ?? [] };
    const browsing = reading !== null;
    const index = browsing ? clamp(reading) : place;

    // Moves the place `times` steps with `step`, stopping at the ends.
    const stepPlace = (times: number, step: (steps: ExpandedStep[], from: nav.Place) => nav.Place | null) => {
      let to = here;
      for (let k = 0; k < times; k++) to = step(steps, to) ?? to;
      if (to !== here) move(to);
    };
    const read = (by: number) => setReading((r) => clamp((r ?? place) + by));

    return {
      ...data,
      project,
      ...here,
      place,
      index,
      step: steps[index],
      browsing,
      neighbors: browsing
        ? { prev: index > 0 ? index - 1 : undefined, next: index < steps.length - 1 ? index + 1 : undefined }
        : { prev: nav.prev(steps, here)?.position.step, next: nav.next(steps, here)?.position.step },
      go: (i) => setReading(i === place ? null : clamp(i)),
      readAhead: () => setReading(clamp(place + 1)),
      backToPlace: () => setReading(null),
      knitFromHere: () => {
        move(nav.moveTo(steps, here, index));
        setReading(null);
      },
      next: () => tap("next", (times) => (browsing ? read(times) : stepPlace(times, nav.next))),
      prev: () => tap("prev", (times) => (browsing ? read(-times) : stepPlace(times, nav.prev))),
      finishRepeat: () => move(nav.finishRepeat(steps, here)),
      countRepeat: (by) => {
        const block = nav.untilBlock(steps, index);
        if (block) move({ ...here, repeats: nav.countRows(steps, here.repeats, block, by) });
      },
      setMark: (mark) => move({ ...here, position: { ...here.position, mark } }),
      tap,
    };
  }, [project, data, move, reading, tap]);
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
      <TapNotice held={held} />
    </KnitContext.Provider>
  );
}
