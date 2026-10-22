import { z } from "zod";
import { findQuote } from "./anchors";
import type { DocMap } from "./docMap";
import type { PageData } from "./pageData";
import { Section, SourceRef, type Node, type Sized } from "../shared/schema";

/**
 * Stage 2 output for one section. Structured outputs can't express recursion
 * and cap optional and union-typed fields, so nodes are one flat, union-free
 * shape: each names its parent, every field is required, and fields that
 * don't apply hold "", [], 0, or "none". `toSection` rebuilds the tree and
 * the strict core schema validates it.
 */

const Ints = z.array(z.number().int());
const Src = z.array(SourceRef.pick({ page: true, quote: true }).required());

export const FlatNode = z.object({
  id: z.string(),
  kind: z.enum(["row", "note", "chart", "repeat", "section"]),
  /** "" for children of the section being extracted. */
  parentId: z.string(),
  /** Size indices this node applies to; [] = all sizes. */
  sizes: Ints,
  /** Option choices this node applies to; [] = always. */
  choices: z.array(z.string()),
  source: Src,
  /** Subsection heading (kind "section"). */
  title: z.string(),
  /** Row/repeat label as printed ("Rnd 5", "Short row 3"). */
  label: z.string(),
  side: z.enum(["RS", "WS", "none"]),
  /** Row, note, or chart-node instruction text, with size values as {a|b|...}. */
  text: z.string(),
  /** Row: how many rows/rounds this instruction covers; [] = 1. */
  rows: Ints,
  /** Row: stitch count after it, if stated; []. */
  stitchCount: Ints,
  /**
   * Row: the charts (and row) it corresponds to. Chart node: the charts
   * worked and their row range. One entry per chart worked across the row
   * (several for side-by-side panels); each entry's ids are one id, or one
   * per size for size-specific charts ("" for sizes without one). [] if none.
   * fromRow/toRow: [n] or one per size; [] when continuing a chart "as set".
   */
  chartRefs: z.array(z.object({ ids: z.array(z.string()) })),
  fromRow: Ints,
  toRow: Ints,
  /** Repeat or subsection ("make 2"): times worked in total; []. */
  times: Ints,
  /** Repeat: open-ended condition ("until piece measures 30 cm"); "". */
  until: z.string(),
  /** Repeat: AT THE SAME TIME schedules, row numbers counted from the repeat's start; []. */
  overlays: z.array(z.object({ id: z.string(), text: z.string(), first: Ints, every: Ints, count: Ints, source: Src })),
});
export type FlatNode = z.infer<typeof FlatNode>;

export const SectionExtraction = z.object({
  /** Times the whole section is worked ("make 2" -> [2]); [] = once. */
  times: Ints,
  nodes: z.array(FlatNode),
  /** Ambiguities a reviewer should look at. */
  reviewNotes: z.array(z.string()),
});
export type SectionExtraction = z.infer<typeof SectionExtraction>;

/** [x] or [x, x, x] -> x; otherwise one value per size. */
const sized = <T,>(xs: T[]): Sized<T> | undefined => (xs.length === 0 ? undefined : xs.every((x) => x === xs[0]) ? xs[0] : xs);
const str = (x: string) => x || undefined;
const arr = <T>(xs: T[]) => (xs.length ? xs : undefined);

const refs = (n: FlatNode) => n.chartRefs.map((r) => sized(r.ids) ?? "");

function toNode(n: FlatNode): Node {
  const base = { id: n.id, sizes: arr(n.sizes), choices: arr(n.choices), source: n.source };
  switch (n.kind) {
    case "section":
      return { ...base, kind: "section", title: n.title || n.label || n.id, times: sized(n.times), children: [] };
    case "repeat":
      return {
        ...base,
        kind: "repeat",
        label: str(n.label),
        times: sized(n.times),
        until: str(n.until),
        overlays: arr(n.overlays.map((o) => ({ ...o, first: sized(o.first) ?? 1, every: sized(o.every), count: sized(o.count) }))),
        children: [],
      };
    case "row":
      return {
        ...base,
        kind: "row",
        label: str(n.label),
        side: n.side === "none" ? undefined : n.side,
        text: n.text,
        rows: sized(n.rows),
        stitchCount: sized(n.stitchCount),
        chart: n.chartRefs.length ? { charts: refs(n), fromRow: sized(n.fromRow) } : undefined,
      };
    case "note":
      return { ...base, kind: "note", text: n.text };
    case "chart":
      return { ...base, kind: "chart", label: str(n.label), charts: refs(n), fromRow: sized(n.fromRow), toRow: sized(n.toRow), text: str(n.text) };
  }
}

/** Rebuild the section tree (root from the map) and validate it against the core schema. */
export function toSection(x: SectionExtraction, meta: DocMap["sections"][number]): Section {
  const root: Section = { id: meta.id, kind: "section", title: meta.title, times: sized(x.times), choices: arr(meta.choices), children: [] };
  const built = new Map<string, Node>(x.nodes.map((n) => [n.id, toNode(n)]));
  for (const n of x.nodes) {
    const parent = n.parentId ? built.get(n.parentId) : root;
    if (!parent || !("children" in parent)) throw new Error(`node ${n.id}: parent ${n.parentId} missing or not a container`);
    parent.children.push(built.get(n.id)!);
  }
  return Section.parse(JSON.parse(JSON.stringify(root)));
}

/** Problems a reviewer (or a repair pass) should see. */
export function checkSection(x: SectionExtraction, map: DocMap, page: (n: number) => PageData | undefined): string[] {
  const problems: string[] = [];
  const nSizes = map.sizes.length;
  const ids = new Set<string>();
  const chartIds = new Set(map.charts.map((c) => c.id));
  const choices = new Set(map.options.flatMap((o) => o.choices));

  const sizedOk = (what: string, xs: unknown[]) => {
    if (xs.length > 1 && xs.length !== nSizes) problems.push(`${what}: ${xs.length} values for ${nSizes} sizes`);
  };
  const quotesOk = (what: string, src: { page: number; quote: string }[]) => {
    if (src.length === 0) problems.push(`${what}: no source`);
    for (const s of src) {
      const p = page(s.page);
      if (!p || findQuote(p, s.quote) < 0) problems.push(`${what}: quote not found on p${s.page}: "${s.quote}"`);
    }
  };

  sizedOk("section times", x.times);
  for (const n of x.nodes) {
    const what = `${n.kind} ${n.id}`;
    if (ids.has(n.id)) problems.push(`${what}: duplicate id`);
    ids.add(n.id);
    if (n.parentId && !x.nodes.some((m) => m.id === n.parentId && (m.kind === "repeat" || m.kind === "section")))
      problems.push(`${what}: parent ${n.parentId} is not a repeat or section in this extraction`);
    for (const i of n.sizes) if (i < 0 || i >= nSizes) problems.push(`${what}: size index ${i} out of range`);
    for (const c of n.choices) if (!choices.has(c)) problems.push(`${what}: unknown choice "${c}"`);
    for (const [k, xs] of [["rows", n.rows], ["stitchCount", n.stitchCount], ["times", n.times], ["fromRow", n.fromRow], ["toRow", n.toRow]] as const)
      sizedOk(`${what} ${k}`, xs);
    n.chartRefs.forEach((r, i) => sizedOk(`${what} chartRefs[${i}]`, r.ids));
    for (const o of n.overlays) for (const [k, xs] of [["first", o.first], ["every", o.every], ["count", o.count]] as const) sizedOk(`${what} overlay ${o.id} ${k}`, xs);
    for (const c of n.chartRefs.flatMap((r) => r.ids)) if (c && !chartIds.has(c)) problems.push(`${what}: unknown chart ${c}`);
    if (n.kind === "chart" && !n.chartRefs.some((r) => r.ids.some(Boolean))) problems.push(`${what}: chart node without a chart`);
    if (n.kind === "repeat" && n.times.length === 0 && !n.until) problems.push(`${what}: repeat with neither times nor until`);
    for (const m of (n.text + " " + n.overlays.map((o) => o.text).join(" ")).matchAll(/\{([^{}]*)\}/g)) {
      const alts = m[1].split("|").length;
      if (alts !== nSizes) problems.push(`${what}: "{${m[1]}}" has ${alts} values for ${nSizes} sizes`);
    }
    quotesOk(what, n.source);
    for (const o of n.overlays) quotesOk(`${what} overlay ${o.id}`, o.source);
  }
  return problems;
}
