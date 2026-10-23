import type { LegendEntry } from "../../../shared/schema";

/** The character drawn in a cell: none for plain knit/purl or no-stitch cells, else the legend key. */
export const symbolFor = (key: string, e: LegendEntry) => (e.noStitch || /^[kp]$/.test(e.rs ?? "") ? "" : key);
