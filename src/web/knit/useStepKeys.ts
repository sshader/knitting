import { useEffect } from "react";
import type { Knit } from "./KnitContext";
import { nextMark, prevMark } from "./navigation";
import { runsForStep } from "./rowRuns";

/**
 * Keys, ignored while typing in a field:
 * - → / j / space: next step; ← / k: previous step
 * - . / ,: next / previous run of stitches in a chart row; past the last run is the next step
 */
export function useStepKeys(knit: Knit | null) {
  useEffect(() => {
    if (!knit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = ACTIONS[e.key];
      if (!action) return;
      // Also stops space from scrolling a panel or pressing a focused button.
      e.preventDefault();
      action(knit);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [knit]);
}

function nextRun(knit: Knit) {
  const row = runsForStep(knit.step, knit.charts);
  if (!row) return knit.next();
  const mark = nextMark(row.layout, knit.position.mark);
  if (mark) knit.setMark(mark);
  else knit.next();
}

function prevRun(knit: Knit) {
  const row = runsForStep(knit.step, knit.charts);
  if (row) knit.setMark(prevMark(row.layout, knit.position.mark) ?? undefined);
}

const ACTIONS: Record<string, (knit: Knit) => void> = {
  ArrowRight: (k) => k.next(),
  j: (k) => k.next(),
  " ": (k) => k.next(),
  ArrowLeft: (k) => k.prev(),
  k: (k) => k.prev(),
  ".": nextRun,
  ",": prevRun,
};
