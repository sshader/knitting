import { z } from "zod";

/**
 * LLM output for chart extraction: one call per pattern names the cell types
 * code found in each chart. Like the other stages: union-free, every field
 * required, "" / 0 / [] for "none".
 */

const LegendEntry = z.object({
  /** A single character to stand for this symbol in the grid. */
  key: z.string(),
  label: z.string(),
  /** Stitch on RS rows (and every round in the round), in the pattern's abbreviations: "k", "p", "m1", "k2tog". */
  rs: z.string(),
  /** Stitch on WS rows for flat charts; "" if in the round or the same as rs. */
  ws: z.string(),
  /** The pattern's name for the yarn color, "" if not colorwork ("MC", "CC", "A"). */
  color: z.string(),
  noStitch: z.boolean(),
  /** Cells covered by one symbol (cables); 1 normally. */
  span: z.number().int(),
});

export const ChartNaming = z.object({
  charts: z.array(
    z.object({
      chartId: z.string(),
      /** Number of the bottom row as printed (usually 1). */
      firstRow: z.number().int(),
      readDirection: z.enum(["rtl", "alternate"]),
      /** Pattern repeat box as column numbers printed on the chart (counted from the right); 0, 0 if none. */
      repeatFromCol: z.number().int(),
      repeatToCol: z.number().int(),
      /** What one cell is, if not a single stitch (e.g. double knitting pairs); "". */
      cellNote: z.string(),
      legend: z.array(LegendEntry),
      /** Every cell type code found, assigned to a legend key. */
      assignments: z.array(z.object({ cellType: z.number().int(), key: z.string() })),
    }),
  ),
  /** For rows written out with colored text: which text color is which yarn. [] otherwise. */
  textColors: z.array(z.object({ hex: z.string(), color: z.string() })),
  notes: z.array(z.string()),
});
export type ChartNaming = z.infer<typeof ChartNaming>;
