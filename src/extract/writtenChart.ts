import { group, type Run } from "../shared/chartRows";
import type { PageData } from "./pageData";
import { inReadingOrder } from "./readingOrder";

/**
 * Parse chart rows a pattern writes out with yarn colors carried by text color
 * (Lucky Stars: "Rnd 3: k9, k2, k25, ..." with each count in cream or purple).
 * Returns one chart's rows per run of row numbers; numbering restarting at 1
 * starts the next chart (the next size's version).
 */

const LABEL = /^\s*(?:rnd|round|row)s?\s*(\d+)\s*:/i;
/** A wrapped continuation line is just stitch counts and punctuation. */
const CONTINUATION = /^[\s,.;]*(?:k\d*[\s,.;]*)+$/i;

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

export interface WrittenChart {
  /** Runs per row number, in working order, with colors named by `colorNames`. */
  rows: Map<number, Run[]>;
  pages: number[];
}

export function parseWrittenColorRows(pages: PageData[], colorNames: Record<string, string>): WrittenChart[] {
  const charts: WrittenChart[] = [];
  let cur: { n: number; stitches: { op: string; color?: string }[] } | null = null;
  let chart: WrittenChart | null = null;

  const finish = () => {
    if (cur && chart) chart.rows.set(cur.n, group(cur.stitches));
    cur = null;
  };

  for (const page of pages) {
    const p = inReadingOrder(page);
    // Lines: consecutive spans at one height.
    const lines: PageData["spans"][] = [];
    for (const s of p.spans) {
      const last = lines.at(-1);
      if (last && Math.abs(last[0].b[1] - s.b[1]) < 0.004) last.push(s);
      else lines.push([s]);
    }
    for (const line of lines) {
      const text = line.map((s) => s.t).join("");
      const m = LABEL.exec(text);
      if (m) {
        finish();
        const n = Number(m[1]);
        if (!chart || n <= Math.max(0, ...chart.rows.keys())) {
          chart = { rows: new Map(), pages: [] };
          charts.push(chart);
        }
        cur = { n, stitches: [] };
      } else if (!(cur && CONTINUATION.test(text))) {
        finish();
        continue;
      }
      if (!chart!.pages.includes(page.page)) chart!.pages.push(page.page);
      for (const s of line) {
        const color = colorNames[hex(s.color)];
        if (!color) continue; // label and punctuation in the main text color
        for (const k of s.t.matchAll(/k(\d*)/gi)) {
          const n = k[1] ? Number(k[1]) : 1;
          for (let i = 0; i < n; i++) cur!.stitches.push({ op: "k", color });
        }
      }
    }
  }
  finish();
  return charts;
}
