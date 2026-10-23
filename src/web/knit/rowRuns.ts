import { formatRun, generateRow, rowStitches, type Run } from "../../shared/chartRows";
import type { Chart } from "../../shared/schema";
import type { ExpandedStep } from "../../shared/expand";
import type { RowLayout } from "./navigation";

export interface RowRun {
  run: Run;
  text: string;
  /** Chart columns it covers (1 = rightmost). */
  cols: { from: number; to: number };
  part: "before" | "repeat" | "after";
}

/**
 * A chart row as the runs a knitter works through ("k9 A", "k2 B", ...), in
 * working order, each with the columns it covers so the chart can show it.
 * `repeats` is how many times the row's repeat is worked, when known.
 */
export function rowRuns(chart: Chart, row: number, repeats?: number): { runs: RowRun[]; layout: RowLayout } {
  const g = generateRow(chart, row, repeats ? { repeats } : {});
  const stitches = rowStitches(chart, row);
  const parts: [RowRun["part"], Run[]][] = g.repeat
    ? [
        ["before", g.repeat.before],
        ["repeat", g.repeat.repeat],
        ["after", g.repeat.after],
      ]
    : [["before", g.runs]];

  // Runs group consecutive stitches, so walking the stitches run by run gives each run's columns.
  const runs: RowRun[] = [];
  let at = 0;
  for (const [part, list] of parts) {
    for (const run of list) {
      const cols = stitches.slice(at, at + run.n).map((s) => s.col);
      at += run.n;
      runs.push({ run, text: formatRun(run), cols: { from: Math.min(...cols), to: Math.max(...cols) }, part });
    }
  }
  const count = (part: RowRun["part"]) => runs.filter((r) => r.part === part).length;
  return { runs, layout: { before: count("before"), repeat: count("repeat"), after: count("after"), times: g.repeat ? (repeats ?? null) : null } };
}

/** The runs of the chart row the step works, or null if it works none. */
export function runsForStep(step: ExpandedStep | undefined, charts: Record<string, { chart: Chart }>) {
  const c = step?.chart && charts[step.chart.chartId];
  return c && step.chart ? rowRuns(c.chart, step.chart.row, step.chart.repeats) : null;
}
