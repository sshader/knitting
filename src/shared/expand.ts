import { expandResult, generateRow, parseRuns } from "./chartRows";
import type { Chart, Node, Section, SourceRef } from "./schema";
import { appliesToSize, textForSize, valueForSize } from "./sized";
import type { Step } from "./steps";

/**
 * Expands a pattern's sections into the steps a knitter works, one per row or
 * round, for one size and set of option choices: repeats and "make 2" are
 * unrolled, multi-row instructions and chart ranges become one step per row,
 * and chart rows get generated instructions. Stitch counts are carried along:
 * a chart row's stitches before / stitches it consumes gives how many times
 * it's worked around (repeats, or 2 for double-knit pairs), and so the count
 * after it.
 */

export interface ExpandInput {
  sections: Section[];
  charts: Record<string, Chart>;
  size: number;
  /** Selected option choices ("bracelet"); nodes limited to other choices are skipped. */
  choices: string[];
}

export interface ExpandedStep extends Step {
  /** Stitch count the pattern states after this step, when it differs from what the chart implies. */
  statedStitches?: number;
  /** AT THE SAME TIME instructions that fall on this step. */
  also?: string[];
  /** Open-ended repeat this step belongs to ("until piece measures 30 cm"). */
  until?: string;
}

export function expandPattern({ sections, charts, size, choices }: ExpandInput): ExpandedStep[] {
  const steps: ExpandedStep[] = [];
  let stitches: number | undefined;
  const chartRow = new Map<string, number>();
  let notes: { title: string; text: string }[] = [];

  const applies = (n: { sizes?: number[]; choices?: string[] }) =>
    appliesToSize(n.sizes, size) && (!n.choices?.length || n.choices.some((c) => choices.includes(c)));
  const text = (t: string | undefined) => (t ? textForSize(t, size) : "");
  const chartFor = (refs: (string | string[])[]) =>
    refs.map((r) => valueForSize(r, size)).filter((id): id is string => !!id && !!charts[id]);

  /** One step; for a chart row, generates its text and carries the stitch count through it. */
  function emit(section: Section, node: Node, label: string, chartIds: string[], row: number | undefined, extra: Partial<ExpandedStep>) {
    const step: ExpandedStep = {
      section: { id: section.id, title: section.title },
      node: node.id,
      label,
      instruction: text("text" in node ? node.text : undefined),
      source: (node.source ?? []).filter((s): s is { page: number; quote: string } & SourceRef => !!s.quote) as Step["source"],
      ...extra,
    };
    if (notes.length) step.related = notes;
    const before = stitches;
    const chart = chartIds.length ? charts[chartIds[0]] : undefined;
    if (chart && row !== undefined) {
      const plain = generateRow(chart, row);
      const factor = before && plain.consumed && before % plain.consumed === 0 ? before / plain.consumed : undefined;
      const g = chart.repeat && factor ? generateRow(chart, row, { repeats: factor }) : plain;
      const written = chart.writtenRows?.[String(row)];
      step.chart = {
        chartId: chart.id,
        row,
        text: g.text,
        perRepeat: g.produced,
        ...(chart.repeat && factor ? { repeats: factor } : {}),
        ...(written !== undefined ? { written, writtenMatches: expandResult(g.runs).join() === expandResult(parseRuns(written)).join() } : {}),
      };
      if (chartIds.length > 1) step.chart.text += ` (with ${chartIds.slice(1).join(", ")} alongside)`;
      chartRow.set(chart.id, row);
      if (factor) stitches = g.produced * factor;
      if (stitches !== undefined && before !== undefined && stitches !== before) step.label += stitches > before ? " (increase round)" : " (decrease round)";
    }
    if (stitches !== undefined) step.stitches = before !== undefined && before !== stitches ? { before, after: stitches } : { after: stitches };
    steps.push(step);
    return step;
  }

  /** After a node's last step: the pattern's stated stitch count wins, noting any disagreement. */
  function stated(node: Node, last: ExpandedStep | undefined) {
    const n = "stitchCount" in node ? valueForSize(node.stitchCount, size) : undefined;
    if (n === undefined || !last) return;
    if (stitches !== undefined && stitches !== n && last.chart) last.statedStitches = n;
    const before = last.stitches?.before ?? stitches;
    stitches = n;
    last.stitches = before !== undefined && before !== n ? { before, after: n } : { after: n };
  }

  function walk(node: Node, section: Section) {
    if (!applies(node)) return;
    switch (node.kind) {
      case "note":
        notes = [...notes, { title: "Note", text: text(node.text) }];
        return;
      case "section": {
        const times = valueForSize(node.times, size) ?? 1;
        for (let t = 0; t < times; t++) for (const c of node.children) walk(c, section);
        return;
      }
      case "repeat": {
        const times = valueForSize(node.times, size) ?? 1;
        const start = steps.length;
        for (let t = 0; t < times; t++) for (const c of node.children) walk(c, section);
        const span = steps.slice(start);
        if (node.until) for (const s of span) s.until = text(node.until);
        for (const o of node.overlays ?? []) {
          const first = valueForSize(o.first, size) ?? 1;
          const every = valueForSize(o.every, size);
          const count = valueForSize(o.count, size) ?? (every ? Infinity : 1);
          for (let k = 0, at = first; k < count && at <= span.length; k++, at += every ?? Infinity) {
            const s = span[at - 1];
            s.also = [...(s.also ?? []), text(o.text)];
          }
        }
        return;
      }
      case "row": {
        const n = valueForSize(node.rows, size) ?? 1;
        const ids = node.chart ? chartFor(node.chart.charts) : [];
        const from = node.chart ? valueForSize(node.chart.fromRow, size) : undefined;
        let last: ExpandedStep | undefined;
        for (let k = 1; k <= n; k++) {
          const row = ids.length ? (from !== undefined ? from + k - 1 : (chartRow.get(ids[0]) ?? 0) + 1) : undefined;
          const label = n > 1 ? `${node.label || "Row"} (${k} of ${n})` : node.label || "Next row";
          last = emit(section, node, label, ids, row, n > 1 ? { of: { index: k, count: n, label: node.label || text(node.text).slice(0, 40) } } : {});
        }
        notes = [];
        stated(node, last);
        return;
      }
      case "chart": {
        const ids = chartFor(node.charts);
        const chart = charts[ids[0]];
        if (!chart) return;
        const first = chart.firstRow ?? 1;
        const from = valueForSize(node.fromRow, size) ?? (chartRow.has(chart.id) ? chartRow.get(chart.id)! + 1 : first);
        const to = valueForSize(node.toRow, size) ?? first + chart.cells.length - 1;
        const word = chart.readDirection === "rtl" ? "Round" : "Row";
        let last: ExpandedStep | undefined;
        for (let r = from; r <= to; r++) {
          last = emit(section, node, `${word} ${r}`, ids, r, { of: { index: r - from + 1, count: to - from + 1, label: node.text ? labelFor(node) : `${word}s ${from}-${to}` } });
        }
        notes = [];
        stated(node, last);
        return;
      }
    }
  }

  for (const section of dedupeBoundaries(sections)) {
    if (!applies(section)) continue;
    const times = valueForSize(section.times, size) ?? 1;
    for (let t = 0; t < times; t++) {
      // A section worked more than once ("make 2" sleeves) is a separate piece
      // with its own stitches; sections that carry on the same piece (yoke
      // after set-up, hem after body) keep the running count.
      if (times > 1) stitches = undefined;
      for (const c of section.children) walk(c, section);
    }
  }
  return steps;
}

/** A chart node's own label if the extraction gave one ("Rounds 2-48"), else its text. */
const labelFor = (node: Node) => ("label" in node && node.label ? node.label : "text" in node && node.text ? node.text.slice(0, 40) : node.id);

/**
 * A line at a section boundary can be extracted by both sections (Moonbun's
 * "All sizes: Knit chart."). Drop a section's last node when the next section
 * starts with a node from the same source quote.
 */
function dedupeBoundaries(sections: Section[]): Section[] {
  return sections.map((s, i) => {
    const next = sections[i + 1]?.children[0];
    const last = s.children.at(-1);
    if (!next || !last) return s;
    const quotes = (n: Node) => new Set((n.source ?? []).map((q) => `${q.page}:${q.quote}`));
    const shared = [...quotes(last)].some((q) => quotes(next).has(q));
    return shared ? { ...s, children: s.children.slice(0, -1) } : s;
  });
}
