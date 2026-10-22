import type { Chart } from "./schema";

/**
 * Written instructions for a chart row, generated from its cells: the row is
 * read in working order (in the round every row right to left; flat, RS rows
 * right to left and WS rows left to right), "no stitch" cells are skipped,
 * and consecutive identical stitches are grouped: "k9 MC, k2 CC, m1 CC".
 *
 * Shaping drawn as "no stitch" cells is read off the row below: cells that
 * turn no-stitch were consumed by the live stitch before them ([live, gray,
 * gray] = a CDD, 3 sts to 1), and cells that turn live consume nothing
 * (increases). In the round, consumed cells at the very start of a row belong
 * to the last decrease, worked with the round's first stitch.
 */

export interface Run {
  op: string;
  color?: string;
  note?: string;
  n: number;
  /** Stitches of the previous row these consume (n for plain stitches; 0 for increases). */
  consumes: number;
}

export interface Stitch {
  op: string;
  color?: string;
  note?: string;
  /** Column it starts at, 1-based from the right as charts number them. */
  col: number;
  consumes: number;
}

export interface GeneratedRow {
  row: number;
  side: "RS" | "WS";
  runs: Run[];
  /** Runs inside the repeat, when the chart has one; `runs` is then the whole row. */
  repeat?: { before: Run[]; repeat: Run[]; after: Run[] };
  /** Stitches of the previous row this row works, and stitches it leaves on the needle. */
  consumed: number;
  produced: number;
  text: string;
}

/** k/p take a count ("k9"); other stitches repeat ("m1 CC ×2"). */
export function formatRun(r: Run): string {
  const color = r.color ? ` ${r.color}` : "";
  const note = r.note ? ` (${r.note})` : "";
  if (/^[kp]$/i.test(r.op)) return `${r.op}${r.n}${color}${note}`;
  return `${r.op}${color}${note}${r.n > 1 ? ` ×${r.n}` : ""}`;
}

export const formatRuns = (runs: Run[]) => runs.map(formatRun).join(", ");

/** Group consecutive identical stitches. */
export function group(stitches: { op: string; color?: string; note?: string; consumes?: number }[]): Run[] {
  const runs: Run[] = [];
  for (const s of stitches) {
    const last = runs.at(-1);
    const consumes = s.consumes ?? 1;
    if (last && last.op === s.op && last.color === s.color && last.note === s.note && last.consumes / last.n === consumes) {
      last.n++;
      last.consumes += consumes;
    } else runs.push({ op: s.op, ...(s.color ? { color: s.color } : {}), ...(s.note ? { note: s.note } : {}), n: 1, consumes });
  }
  return runs;
}

/** Is this chart row worked on the right side? Row 1 is RS; in the round, every row is. */
export const isRS = (chart: Chart, row: number) => chart.readDirection === "rtl" || row % 2 === 1;

/** Name for a decrease working `n` stitches into one. */
const decrease = (n: number) => (n === 2 ? "k2tog" : n === 3 ? "CDD" : `dec ${n} to 1`);

/** The stitches of one chart row in working order. */
export function rowStitches(chart: Chart, row: number): Stitch[] {
  const at = (r: number) => chart.cells[r - (chart.firstRow ?? 1)];
  const cells = at(row);
  if (cells === undefined) throw new Error(`chart ${chart.id} has no row ${row}`);
  const below = row > (chart.firstRow ?? 1) ? at(row - 1) : undefined;
  const rs = isRS(chart, row);
  const live = (key: string | undefined) => {
    if (key === undefined || key === " ") return false;
    const e = chart.legend[key];
    if (!e) throw new Error(`chart ${chart.id} row ${row}: no legend entry for "${key}"`);
    return !e.noStitch;
  };
  // Columns as charts number them: 1 is the rightmost cell.
  const cols = [...cells].map((key, i) => ({ key, below: below?.[i], col: cells.length - i }));
  const order = rs ? cols.reverse() : cols;
  const consumed = (i: number) => below !== undefined && !live(order[i].key) && live(order[i].below);

  const out: Stitch[] = [];
  let leading = 0;
  while (leading < order.length && consumed(leading)) leading++;
  // Consumed cells met before a live stitch (next to existing no-stitch
  // cells) go into that next stitch.
  let pending = 0;
  for (let i = leading; i < order.length; i++) {
    const { key, col } = order[i];
    if (!live(key)) {
      if (consumed(i)) pending++;
      continue;
    }
    const entry = chart.legend[key];
    const span = entry.span ?? 1;
    // Consumed cells right after this stitch go into it too.
    let j = i + span;
    while (j < order.length && consumed(j)) j++;
    const taken = pending + (j - i - span);
    pending = 0;
    const isIncrease = below !== undefined && !live(order[i].below);
    const base = (rs ? entry.rs : (entry.ws ?? entry.rs)) ?? entry.label;
    out.push({
      op: taken ? decrease(span + taken) : base,
      color: entry.color,
      col,
      consumes: isIncrease ? 0 : span + taken,
    });
    i = j - 1;
  }
  // Consumed cells after the last live stitch close it.
  if (pending && out.length) {
    const last = out[out.length - 1];
    last.consumes += pending;
    last.op = decrease(last.consumes);
  }
  if (leading && out.length) {
    // In the round the row's leading consumed cells close the round's last
    // decrease; flat, they belong to the first stitch.
    const inRound = chart.readDirection === "rtl";
    const s = inRound ? out[out.length - 1] : out[0];
    s.consumes += leading;
    s.op = decrease(s.consumes);
    if (inRound) s.note = "with the round's first st";
  }
  return out;
}

const sts = (n: number) => `${n} ${n === 1 ? "st" : "sts"}`;

/** `repeats`: how many times the repeat is worked, when known ("repeat 12 times" instead of "repeat to end"). */
export function generateRow(chart: Chart, row: number, opts: { repeats?: number } = {}): GeneratedRow {
  const stitches = rowStitches(chart, row);
  const runs = group(stitches);
  const side = isRS(chart, row) ? "RS" : "WS";
  const consumed = stitches.reduce((n, s) => n + s.consumes, 0);
  const produced = stitches.length;
  const base = { row, side, runs, consumed, produced } as const;
  const rep = chart.repeat;
  if (!rep) return { ...base, text: formatRuns(runs) };

  const inRep = (c: number) => c >= rep.fromCol && c <= rep.toCol;
  const firstIn = stitches.findIndex((s) => inRep(s.col));
  const lastIn = stitches.length - 1 - [...stitches].reverse().findIndex((s) => inRep(s.col));
  if (firstIn < 0) return { ...base, text: formatRuns(runs) };
  const before = group(stitches.slice(0, firstIn));
  const repeat = group(stitches.slice(firstIn, lastIn + 1));
  const after = group(stitches.slice(lastIn + 1));
  const howMany = opts.repeats ? ` ${opts.repeats} times` : after.length ? ` to last ${sts(after.reduce((n, r) => n + r.n, 0))}` : " to end";
  const text = [before.length ? formatRuns(before) : "", `*${formatRuns(repeat)}*, repeat${howMany}`, after.length ? formatRuns(after) : ""]
    .filter(Boolean)
    .join(", ");
  return { ...base, repeat: { before, repeat, after }, text };
}

/** Parse "k9 MC, k2 CC" (or the pattern's "k9, k2" with colors given separately) back into runs. */
export function parseRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const m of text.matchAll(/\b([kp])(\d*)(?:\s+([A-Za-z]{1,3})\b)?/g)) {
    const n = m[2] ? Number(m[2]) : 1;
    runs.push({ op: m[1].toLowerCase(), n, consumes: n, ...(m[3] ? { color: m[3] } : {}) });
  }
  return runs;
}

/** Runs to one entry per stitch, for comparing rows written in different groupings. */
export const expand = (runs: Run[]) => runs.flatMap((r) => Array.from({ length: r.n }, () => `${r.op}${r.color ? ` ${r.color}` : ""}`));

/**
 * Like `expand`, but as the row looks once worked: each decrease leaves one
 * knit stitch in its color. For comparing with rows a pattern writes out as
 * the resulting stitches ("k18 A, k4 B, ..." for a decrease round).
 */
export const expandResult = (runs: Run[]) =>
  runs.flatMap((r) => Array.from({ length: r.n }, () => `${r.consumes / r.n > 1 ? "k" : r.op}${r.color ? ` ${r.color}` : ""}`));
