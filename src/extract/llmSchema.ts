import { z } from "zod";
import { Chart, Overlay, Pattern, SourceRef, Sized, type Node, type Section } from "../shared/schema";

/**
 * What the LLM emits. Structured outputs can't express recursive schemas, so
 * the node tree is flattened: each node names its parent and the tree is
 * rebuilt in `toPattern`. Source refs carry quotes only; bboxes are filled in
 * later by matching quotes against the PDF text layer.
 */
const Src = z.array(SourceRef.omit({ bbox: true }));
const Common = { id: z.string(), parentId: z.string().nullable(), sizes: z.array(z.number().int()).nullable(), source: Src };
const SizedInt = Sized(z.number().int());

export const FlatNode = z.discriminatedUnion("kind", [
  z.object({ ...Common, kind: z.literal("section"), title: z.string(), times: SizedInt.nullable() }),
  z.object({
    ...Common,
    kind: z.literal("row"),
    label: z.string().nullable(),
    side: z.enum(["RS", "WS"]).nullable(),
    text: z.string(),
    rows: SizedInt.nullable(),
    stitchCount: SizedInt.nullable(),
    chart: z.object({ chartId: z.string(), fromRow: z.number().int() }).nullable(),
  }),
  z.object({ ...Common, kind: z.literal("note"), text: z.string() }),
  z.object({
    ...Common,
    kind: z.literal("chart"),
    chartId: z.string(),
    fromRow: z.number().int().nullable(),
    toRow: z.number().int().nullable(),
    text: z.string().nullable(),
  }),
  z.object({
    ...Common,
    kind: z.literal("repeat"),
    label: z.string().nullable(),
    times: SizedInt.nullable(),
    until: z.string().nullable(),
    overlays: z.array(Overlay.extend({ source: Src })),
  }),
]);
export type FlatNode = z.infer<typeof FlatNode>;

export const LlmChart = Chart.omit({ legend: true, source: true }).extend({
  legend: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      color: z.string().nullable(),
      abbrev: z.string().nullable(),
      span: z.number().int().nullable(),
    }),
  ),
  page: z.number().int(),
  /** The model's confidence that `cells` is transcribed exactly. */
  cellsConfidence: z.enum(["high", "medium", "low"]),
});

export const LlmExtraction = Pattern.omit({ sections: true, charts: true, sourcePdf: true }).extend({
  nodes: z.array(FlatNode),
  charts: z.array(LlmChart),
  /** Anything ambiguous the human reviewer should look at. */
  reviewNotes: z.array(z.object({ nodeId: z.string().nullable(), note: z.string() })),
});
export type LlmExtraction = z.infer<typeof LlmExtraction>;

const dropNulls = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as { [K in keyof T]: Exclude<T[K], null> };

/** Rebuild the node tree and normalize into a Pattern. Throws if the result doesn't validate. */
export function toPattern(x: LlmExtraction, sourcePdf: Pattern["sourcePdf"]): Pattern {
  const built = new Map<string, Node>();
  const children = new Map<string | null, string[]>();
  for (const n of x.nodes) {
    const { parentId, ...rest } = n;
    const node = dropNulls(rest) as Node;
    if (node.kind === "section" || node.kind === "repeat") (node as Section).children = [];
    if (node.sizes?.length === 0) delete node.sizes;
    built.set(n.id, node);
    children.set(parentId, [...(children.get(parentId) ?? []), n.id]);
  }
  for (const [parentId, ids] of children) {
    if (parentId === null) continue;
    const parent = built.get(parentId);
    if (!parent || !("children" in parent)) throw new Error(`node parent ${parentId} missing or not a container`);
    parent.children.push(...ids.map((id) => built.get(id)!));
  }
  const { nodes: _n, charts, reviewNotes: _r, ...meta } = x;
  return Pattern.parse({
    ...meta,
    sections: (children.get(null) ?? []).map((id) => built.get(id)),
    charts: charts.map(({ legend, page, cellsConfidence: _c, ...c }) => ({
      ...c,
      legend: Object.fromEntries(legend.map(({ key, ...l }) => [key, dropNulls(l)])),
      source: [{ page }],
    })),
    sourcePdf,
  });
}
