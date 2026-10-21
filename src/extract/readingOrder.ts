import { union, type BBox, type PageData } from "./pageData";

/**
 * Reading order for a page's text. PDFs store text in arbitrary order
 * (Moonbun puts each "SIZE n" heading after its rounds), and sorting lines by
 * position interleaves columns.
 *
 * Units are text lines, split wherever words are a column gutter apart (side
 * by side headings can share one PDF line). Order them by recursive XY-cut:
 * split into horizontal bands at full-width gaps, keep bands together while
 * they share a column gutter, split those runs into columns, recurse. Words
 * and spans keep their order within a unit.
 */

interface Unit {
  key: string;
  b: BBox;
}

const MIN_H_GAP = 0.004; // ~3pt on a letter page: more than line-spacing slop
const MIN_V_GAP = 0.012; // a column gutter
/** Gap at which one PDF line is really two (side-by-side headings); wider than letter-spaced or justified text. */
const LINE_SPLIT_GAP = 0.05;

/** Split into groups separated by gaps in the projection onto one axis. */
function splitAt(units: Unit[], axis: 0 | 1, minGap: number): Unit[][] {
  const lo = axis === 0 ? 0 : 1;
  const hi = axis === 0 ? 2 : 3;
  const sorted = [...units].sort((a, b) => a.b[lo] - b.b[lo]);
  const groups: Unit[][] = [];
  let end = -Infinity;
  for (const u of sorted) {
    if (groups.length === 0 || u.b[lo] - end > minGap) groups.push([u]);
    else groups.at(-1)!.push(u);
    end = Math.max(end, u.b[hi]);
  }
  return groups;
}

/** Narrower than this, a unit is a marker (bullet, list number), not running text. */
const MARKER_W = 0.03;

/**
 * Columns: groups split by vertical gaps. A group of only markers (bullets
 * hanging left of their text) isn't a column; fold it into the group to its right.
 */
function columnsOf(units: Unit[]): Unit[][] {
  const groups = splitAt(units, 0, MIN_V_GAP);
  const out: Unit[][] = [];
  for (let i = 0; i < groups.length; i++) {
    const markersOnly = groups[i].every((u) => u.b[2] - u.b[0] < MARKER_W);
    if (markersOnly && i + 1 < groups.length) groups[i + 1] = [...groups[i], ...groups[i + 1]];
    else if (markersOnly && out.length) out.at(-1)!.push(...groups[i]);
    else out.push(groups[i]);
  }
  return out;
}

/** Whether some vertical gap splits these units into columns. */
const hasGutter = (units: Unit[]) => columnsOf(units).length > 1;

/**
 * Horizontal bands cut straight through multi-column text wherever paragraph
 * gaps line up across columns. Merge each band into the previous run while the
 * combined run still has a gutter nothing crosses, so columns stay together
 * until something spans them (a full-width heading or paragraph).
 */
function mergeColumnBands(bands: Unit[][]): Unit[][] {
  const heights = bands.flat().map((u) => u.b[3] - u.b[1]);
  const lineH = heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 0.01;
  const out: Unit[][] = [];
  bands.forEach((band, i) => {
    const cur = out.at(-1);
    if (cur && hasGutter([...cur, ...band]) && continuesColumns(cur, band, bands.slice(i + 1), lineH)) cur.push(...band);
    else out.push([...band]);
  });
  return out;
}

/**
 * A band that only has text on one side of the gutter (a heading under two
 * columns, or a column running longer than its neighbor) continues the run if
 * the other column still has text alongside or further down (before anything
 * crosses the gutter), or it sits close under the text above it (paragraph
 * spacing, not a section-sized gap).
 */
function continuesColumns(run: Unit[], band: Unit[], later: Unit[][], lineH: number): boolean {
  const cols = columnsOf([...run, ...band]);
  if (new Set(band.map((u) => cols.findIndex((c) => c.includes(u)))).size > 1) return true;
  const gaps = cols.slice(1).map((c, k): [number, number] => [Math.max(...cols[k].map((u) => u.b[2])), Math.min(...c.map((u) => u.b[0]))]);
  // Crossing means spanning the gutter's middle; edges wobble with alignment and indents.
  const crosses = (u: Unit) => gaps.some(([a, b]) => u.b[0] < (a + b) / 2 && u.b[2] > (a + b) / 2);
  const side = (u: Unit) => gaps.filter(([a]) => u.b[0] >= a).length;
  const bandSide = side(band[0]);
  const top = Math.min(...band.map((u) => u.b[1]));

  let otherContinues = run.some((u) => side(u) !== bandSide && u.b[3] >= top - MIN_H_GAP);
  for (const next of later) {
    if (otherContinues || next.some(crosses)) break;
    otherContinues = next.some((u) => side(u) !== bandSide);
  }
  const above = run.filter((u) => side(u) === bandSide).map((u) => u.b[3]);
  const gap = top - (above.length ? Math.max(...above) : Math.max(...run.map((u) => u.b[3])));
  return otherContinues || gap <= 1.5 * lineH;
}

/**
 * Many columns of short cells is a table (sizes x measurements), not a text
 * layout; prose columns (and a sidebar) have wide lines.
 */
function isTable(units: Unit[], columns: Unit[][]) {
  if (columns.length < 4) return false;
  const widths = units.map((u) => u.b[2] - u.b[0]).sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)] < 0.08;
}

/** Tables read row by row: group units into rows by vertical overlap, each left to right. */
function rowMajor(units: Unit[]): Unit[] {
  return splitAt(units, 1, -0.002).flatMap((row) => [...row].sort((a, b) => a.b[0] - b.b[0]));
}

function xyCut(units: Unit[]): Unit[] {
  if (units.length <= 1) return units;
  const bands = mergeColumnBands(splitAt(units, 1, MIN_H_GAP));
  if (bands.length > 1) return bands.flatMap(xyCut);
  const columns = columnsOf(units);
  if (isTable(units, columns)) return rowMajor(units);
  if (columns.length > 1) return columns.flatMap(xyCut);
  return [...units].sort((a, b) => a.b[1] - b.b[1] || a.b[0] - b.b[0]);
}

/** Line units from words: one per PDF line, split at column-sized gaps. Also returns each word's unit key. */
function lineUnits(p: PageData): { units: Unit[]; wordUnit: string[] } {
  const boxes = new Map<string, BBox[]>();
  const wordUnit: string[] = [];
  let seg = 0;
  p.words.forEach((w, i) => {
    const prev = p.words[i - 1];
    const sameLine = prev && prev.blk === w.blk && prev.ln === w.ln;
    if (!sameLine) seg = 0;
    else if (w.b[0] - prev.b[2] > LINE_SPLIT_GAP) seg++;
    const key = `${w.blk}:${w.ln}:${seg}`;
    wordUnit.push(key);
    const bs = boxes.get(key);
    if (bs) bs.push(w.b);
    else boxes.set(key, [w.b]);
  });
  return { units: [...boxes].map(([key, bs]) => ({ key, b: union(bs) })), wordUnit };
}

const cache = new WeakMap<PageData, PageData>();

/** The page with words and spans reordered into reading order. */
export function inReadingOrder(p: PageData): PageData {
  const hit = cache.get(p);
  if (hit) return hit;
  const { units, wordUnit } = lineUnits(p);
  const ordered = xyCut(units);
  const rank = new Map(ordered.map((u, i) => [u.key, i]));

  // Spans carry no line ids; place each by the unit containing its center (same block preferred).
  const spanRank = p.spans.map((s) => {
    const cx = (s.b[0] + s.b[2]) / 2;
    const cy = (s.b[1] + s.b[3]) / 2;
    const inside = ordered.filter((u) => cx >= u.b[0] - 0.002 && cx <= u.b[2] + 0.002 && cy >= u.b[1] - 0.002 && cy <= u.b[3] + 0.002);
    const best = inside.find((u) => u.key.startsWith(`${s.blk}:`)) ?? inside[0];
    return best ? rank.get(best.key)! : Infinity;
  });

  const sortBy = <T,>(xs: T[], r: (i: number) => number) =>
    xs
      .map((x, i) => ({ x, i, r: r(i) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map(({ x }) => x);
  const out = { ...p, words: sortBy(p.words, (i) => rank.get(wordUnit[i])!), spans: sortBy(p.spans, (i) => spanRank[i]) };
  cache.set(p, out);
  cache.set(out, out);
  return out;
}
