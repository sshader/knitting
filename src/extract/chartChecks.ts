import { rowStitches } from "../shared/chartRows";
import type { Chart } from "../shared/schema";
import type { FlatNode } from "./sectionSchema";

/**
 * Checks a chart against stitch counts the pattern states in its sections:
 * wherever a section works this chart up to a row and gives the stitch count
 * after it, that count must be a whole number of chart widths (repeats), and
 * the number of repeats per size must be the same at every checkpoint. A grid
 * misread by a row or column, or a misnamed increase/no-stitch cell, breaks this.
 */
export interface StitchCountCheck {
  checkpoints: { node: string; row: number; size: number; stated: number; perRepeat: number; repeats: number }[];
  problems: string[];
}

export function checkStitchCounts(chart: Chart, nodes: FlatNode[], sizeNames: string[]): StitchCountCheck {
  const checkpoints: StitchCountCheck["checkpoints"] = [];
  const problems: string[] = [];
  for (const n of nodes) {
    if (n.stitchCount.length === 0) continue;
    for (let size = 0; size < sizeNames.length; size++) {
      if (n.sizes.length && !n.sizes.includes(size)) continue;
      const usesChart = n.chartRefs.some((r) => (r.ids.length > 1 ? r.ids[size] : r.ids[0]) === chart.id);
      if (!usesChart) continue;
      const rows = n.toRow.length ? n.toRow : n.fromRow;
      const row = rows.length > 1 ? rows[size] : rows[0];
      const stated = n.stitchCount.length > 1 ? n.stitchCount[size] : n.stitchCount[0];
      if (!row || !stated) continue;
      const perRepeat = rowStitches(chart, row).length;
      if (perRepeat === 0 || stated % perRepeat !== 0) {
        problems.push(`${n.id}, size ${sizeNames[size]}: ${stated} sts after row ${row} isn't a whole number of ${perRepeat}-st chart rows`);
        continue;
      }
      checkpoints.push({ node: n.id, row, size, stated, perRepeat, repeats: stated / perRepeat });
    }
  }
  for (let size = 0; size < sizeNames.length; size++) {
    const reps = new Set(checkpoints.filter((c) => c.size === size).map((c) => c.repeats));
    if (reps.size > 1) problems.push(`size ${sizeNames[size]}: stitch counts imply different repeat counts (${[...reps].join(", ")})`);
  }
  return { checkpoints, problems };
}
