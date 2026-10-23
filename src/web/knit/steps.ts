import type { ExpandedStep } from "../../shared/expand";

/**
 * Finding your way around the expanded steps: where a saved position is,
 * how steps group in the outline, and which chart to show.
 */

/** The saved step, or if the steps changed under it (a re-extraction), the nearest step from the same node. */
export function resolveStep(steps: ExpandedStep[], position: { step: number; node: string }): number {
  if (steps.length === 0) return 0;
  const clamped = Math.min(Math.max(0, position.step), steps.length - 1);
  if (!position.node || steps[clamped].node === position.node) return clamped;
  let best = -1;
  steps.forEach((s, i) => {
    if (s.node === position.node && (best < 0 || Math.abs(i - clamped) < Math.abs(best - clamped))) best = i;
  });
  return best >= 0 ? best : clamped;
}

/** A run of steps from one multi-row instruction ("Rounds 2-48"), or a single step. */
export interface StepGroup {
  start: number;
  count: number;
  label: string;
  section: ExpandedStep["section"];
}

export function groupSteps(steps: ExpandedStep[]): StepGroup[] {
  const groups: StepGroup[] = [];
  steps.forEach((s, i) => {
    const prev = steps[i - 1];
    const last = groups.at(-1);
    const continues = last && prev && s.node === prev.node && s.of && prev.of && s.of.label === prev.of.label && s.of.index === prev.of.index + 1;
    if (continues) last.count++;
    else groups.push({ start: i, count: 1, label: s.of && s.of.count > 1 ? s.of.label : s.label, section: s.section });
  });
  return groups;
}

export interface ChartFocus {
  chartId: string;
  /** The row worked on this step; null when the step works no chart. */
  row: number | null;
  /** Otherwise, the next step that works this chart, and its row. */
  upcoming?: { step: number; row: number };
}

/**
 * The chart to show at a step: its own chart row, or if it works no chart,
 * the next chart coming up (else the last one used), with no row selected.
 */
export function chartFocus(steps: ExpandedStep[], i: number): ChartFocus | null {
  const own = steps[i]?.chart;
  if (own) return { chartId: own.chartId, row: own.row };
  const next = steps.findIndex((s, j) => j > i && s.chart);
  if (next >= 0) return { chartId: steps[next].chart!.chartId, row: null, upcoming: { step: next, row: steps[next].chart!.row } };
  for (let j = i - 1; j >= 0; j--) if (steps[j].chart) return { chartId: steps[j].chart!.chartId, row: null };
  return null;
}

/** The step working chart row `row` of `chartId` closest to step `i`. */
export function stepForChartRow(steps: ExpandedStep[], i: number, chartId: string, row: number): number | null {
  let best: number | null = null;
  steps.forEach((s, j) => {
    if (s.chart?.chartId === chartId && s.chart.row === row && (best === null || Math.abs(j - i) < Math.abs(best - i))) best = j;
  });
  return best;
}
