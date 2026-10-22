import type { Chart } from "./schema";

/**
 * Written instructions for a chart row, generated from its cells: the row is
 * read in working order (in the round every row right to left; flat, RS rows
 * right to left and WS rows left to right), "no stitch" cells are skipped,
 * and consecutive identical stitches are grouped: "k9 MC, k2 CC, m1 CC".
 */

export interface Run {
  op: string;
  color?: string;
  n: number;
}

export interface GeneratedRow {
  row: number;
  side: "RS" | "WS";
  runs: Run[];
  /** Runs inside the repeat, when the chart has one; `runs` is then the whole row. */
  repeat?: { before: Run[]; repeat: Run[]; after: Run[] };
  text: string;
}

/** k/p take a count ("k9"); other stitches repeat ("m1 CC ×2"). */
export function formatRun(r: Run): string {
  const color = r.color ? ` ${r.color}` : "";
  if (/^[kp]$/i.test(r.op)) return `${r.op}${r.n}${color}`;
  return `${r.op}${color}${r.n > 1 ? ` ×${r.n}` : ""}`;
}

export const formatRuns = (runs: Run[]) => runs.map(formatRun).join(", ");

/** Group consecutive identical stitches. */
export function group(stitches: { op: string; color?: string }[]): Run[] {
  const runs: Run[] = [];
  for (const s of stitches) {
    const last = runs.at(-1);
    if (last && last.op === s.op && last.color === s.color) last.n++;
    else runs.push({ ...s, n: 1 });
  }
  return runs;
}

/** Is this chart row worked on the right side? Row 1 is RS; in the round, every row is. */
export const isRS = (chart: Chart, row: number) => chart.readDirection === "rtl" || row % 2 === 1;

/**
 * The stitches of one chart row in working order, each tagged with the
 * column it starts at (1-based, counted from the right as charts number them).
 */
export function rowStitches(chart: Chart, row: number): { op: string; color?: string; col: number }[] {
  const cells = chart.cells[row - (chart.firstRow ?? 1)];
  if (cells === undefined) throw new Error(`chart ${chart.id} has no row ${row}`);
  const rs = isRS(chart, row);
  // Columns as charts number them: 1 is the rightmost cell.
  const cols = [...cells].map((key, i) => ({ key, col: cells.length - i }));
  const order = rs ? cols.reverse() : cols;
  const out: { op: string; color?: string; col: number }[] = [];
  for (let i = 0; i < order.length; i++) {
    const { key, col } = order[i];
    if (key === " ") continue;
    const entry = chart.legend[key];
    if (!entry) throw new Error(`chart ${chart.id} row ${row}: no legend entry for "${key}"`);
    if (entry.noStitch) continue;
    const op = (rs ? entry.rs : (entry.ws ?? entry.rs)) ?? entry.label;
    out.push({ op, color: entry.color, col });
    i += (entry.span ?? 1) - 1;
  }
  return out;
}

const sts = (n: number) => `${n} ${n === 1 ? "st" : "sts"}`;

export function generateRow(chart: Chart, row: number): GeneratedRow {
  const stitches = rowStitches(chart, row);
  const runs = group(stitches);
  const side = isRS(chart, row) ? "RS" : "WS";
  const rep = chart.repeat;
  if (!rep) return { row, side, runs, text: formatRuns(runs) };

  const inRep = (c: number) => c >= rep.fromCol && c <= rep.toCol;
  const firstIn = stitches.findIndex((s) => inRep(s.col));
  const lastIn = stitches.length - 1 - [...stitches].reverse().findIndex((s) => inRep(s.col));
  if (firstIn < 0) return { row, side, runs, text: formatRuns(runs) };
  const before = group(stitches.slice(0, firstIn));
  const repeat = group(stitches.slice(firstIn, lastIn + 1));
  const after = group(stitches.slice(lastIn + 1));
  const text = [
    before.length ? formatRuns(before) : "",
    `*${formatRuns(repeat)}*, repeat${after.length ? ` to last ${sts(after.reduce((n, r) => n + r.n, 0))}` : " to end"}`,
    after.length ? formatRuns(after) : "",
  ]
    .filter(Boolean)
    .join(", ");
  return { row, side, runs, repeat: { before, repeat, after }, text };
}

/** Parse "k9 MC, k2 CC" (or the pattern's "k9, k2" with colors given separately) back into runs. */
export function parseRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const m of text.matchAll(/\b([kp])(\d*)(?:\s+([A-Za-z]{1,3})\b)?/g)) {
    runs.push({ op: m[1].toLowerCase(), n: m[2] ? Number(m[2]) : 1, ...(m[3] ? { color: m[3] } : {}) });
  }
  return runs;
}

/** Runs to one entry per stitch, for comparing rows written in different groupings. */
export const expand = (runs: Run[]) => runs.flatMap((r) => Array.from({ length: r.n }, () => `${r.op}${r.color ? ` ${r.color}` : ""}`));
