import { z } from "zod";
import { Chart, Pattern, SourceRef, type Node, type Section, type Sized } from "../shared/schema";

/**
 * What the LLM emits. Structured outputs can't express recursive schemas and
 * cap the number of union-typed fields, so:
 * - the node tree is flattened (each node names its parent) and rebuilt in `toPattern`;
 * - nodes are one object with a `kind` enum and optional fields, not a union;
 *   the strict `Node` schema validates the rebuilt tree;
 * - size-dependent numbers are always arrays ([n] when the same for all sizes).
 * Source refs carry quotes only; bboxes come later from the PDF text layer.
 */
const Src = z.array(SourceRef.omit({ bbox: true }));
const Ints = z.array(z.number().int());

export const FlatNode = z.object({
  id: z.string(),
  kind: z.enum(["section", "row", "note", "chart", "repeat"]),
  /** "" for top-level sections. */
  parentId: z.string(),
  /** Size indices this node applies to; [] = all sizes. */
  sizes: Ints,
  source: Src,
  /** section title; "" otherwise */
  title: z.string(),
  /** section ("make 2") / repeat; [] if not applicable */
  times: Ints,
  /** row / repeat label as printed; "" if none */
  label: z.string(),
  side: z.enum(["RS", "WS", "none"]),
  /** row / note / chart instruction text */
  text: z.string(),
  /** row: rows this instruction covers; [] = 1 */
  rows: Ints,
  stitchCount: Ints,
  /** row: chart row this instruction corresponds to */
  chartRef: z.object({ chartId: z.string(), fromRow: z.number().int() }).optional(),
  /** chart node: chart id and row range; ""/0 if not applicable */
  chartId: z.string(),
  fromRow: z.number().int(),
  toRow: z.number().int(),
  /** repeat: open-ended condition; "" if fixed */
  until: z.string(),
  /** repeat: AT THE SAME TIME schedules; [] otherwise */
  overlays: z.array(
    z.object({ id: z.string(), text: z.string(), first: Ints, every: Ints, count: Ints, source: Src }),
  ),
});
export type FlatNode = z.infer<typeof FlatNode>;

export const LlmChart = Chart.omit({ legend: true, source: true }).extend({
  legend: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      color: z.string().optional(),
      abbrev: z.string().optional(),
      span: z.number().int().optional(),
    }),
  ),
  page: z.number().int(),
  /** The model's confidence that `cells` is transcribed exactly. */
  cellsConfidence: z.enum(["high", "medium", "low"]),
});

export const LlmExtraction = Pattern.omit({ sections: true, charts: true, sourcePdf: true }).extend({
  techniques: z.array(z.object({ name: z.string(), text: z.string(), source: Src })),
  nodes: z.array(FlatNode),
  charts: z.array(LlmChart),
  /** Anything ambiguous the human reviewer should look at. */
  reviewNotes: z.array(z.object({ nodeId: z.string().optional(), note: z.string() })),
});
export type LlmExtraction = z.infer<typeof LlmExtraction>;

/** [n] or [n, n, n] -> n; otherwise one value per size. */
const sized = (xs: number[] | undefined): Sized<number> | undefined =>
  xs === undefined || xs.length === 0 ? undefined : xs.every((x) => x === xs[0]) ? xs[0] : xs;

const str = (x: string) => x || undefined;
const int = (x: number) => x || undefined;

function toNode(n: FlatNode): Node {
  const base = { id: n.id, sizes: n.sizes.length ? n.sizes : undefined, source: n.source };
  switch (n.kind) {
    case "section":
      return { ...base, kind: "section", title: n.title || n.id, times: sized(n.times), children: [] };
    case "repeat":
      return {
        ...base,
        kind: "repeat",
        label: str(n.label),
        times: sized(n.times),
        until: str(n.until),
        overlays: n.overlays.length
          ? n.overlays.map((o) => ({ ...o, first: sized(o.first)!, every: sized(o.every), count: sized(o.count) }))
          : undefined,
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
        chart: n.chartRef,
      };
    case "note":
      return { ...base, kind: "note", text: n.text };
    case "chart":
      return { ...base, kind: "chart", chartId: n.chartId, fromRow: int(n.fromRow), toRow: int(n.toRow), text: str(n.text) };
  }
}

/** Rebuild the node tree and normalize into a Pattern. Throws if the result doesn't validate. */
export function toPattern(x: LlmExtraction, sourcePdf: Pattern["sourcePdf"]): Pattern {
  const built = new Map(x.nodes.map((n) => [n.id, toNode(n)]));
  const roots: Node[] = [];
  for (const n of x.nodes) {
    const node = built.get(n.id)!;
    if (!n.parentId) {
      roots.push(node);
      continue;
    }
    const parent = built.get(n.parentId);
    if (!parent || !("children" in parent)) throw new Error(`node ${n.id}: parent ${n.parentId} missing or not a container`);
    parent.children.push(node);
  }
  const { nodes: _n, charts, reviewNotes: _r, ...meta } = x;
  return Pattern.parse({
    ...meta,
    sections: roots,
    charts: charts.map(({ legend, page, cellsConfidence: _c, ...c }) => ({
      ...c,
      legend: Object.fromEntries(legend.map(({ key, ...l }) => [key, l])),
      source: [{ page }],
    })),
    sourcePdf,
  });
}
