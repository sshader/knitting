import { expandResult, generateRow, parseRuns } from "../shared/chartRows";
import type { Chart } from "../shared/schema";

/**
 * Every row of a chart as generated instructions, compared with the
 * pattern's own written rows where it has them: how many stitches differ.
 * Patterns write a decrease round as the stitches it leaves ("k18 A, ..."),
 * so both sides are compared as worked (see `expandResult`).
 */

export interface RowReport {
  row: number;
  side?: "RS" | "WS";
  text?: string;
  stitches?: number;
  written?: string;
  /** Stitches that differ from the written row; null when the pattern doesn't write this row out. */
  differs?: number | null;
  error?: string;
}

export interface WrittenComparison {
  rows: number;
  identical: number;
  stitchesDiffering: number;
}

export function chartReport(chart: Chart): { rows: RowReport[]; written: WrittenComparison | null } {
  const rows = chart.cells.map((_, i): RowReport => {
    const n = i + (chart.firstRow ?? 1);
    try {
      const g = generateRow(chart, n);
      const written = chart.writtenRows?.[String(n)];
      const gen = expandResult(g.runs);
      const want = written ? expandResult(parseRuns(written)) : null;
      const differs = want ? Math.max(gen.length, want.length) - gen.filter((s, j) => s === want[j]).length : null;
      return { row: n, side: g.side, text: g.text, stitches: gen.length, written, differs };
    } catch (e) {
      return { row: n, error: String(e) };
    }
  });
  const compared = rows.filter((r) => r.differs != null);
  const written = compared.length
    ? { rows: compared.length, identical: compared.filter((r) => r.differs === 0).length, stitchesDiffering: compared.reduce((n, r) => n + r.differs!, 0) }
    : null;
  return { rows, written };
}
