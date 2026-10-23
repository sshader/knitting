import type { Chart } from "../../../shared/schema";

/**
 * Where things sit in a drawn chart, in SVG units (the panel scales the
 * drawing): row 1 at the bottom, column 1 at the right.
 */

export const CELL = 16;
/** Room above for the repeat bracket, and a little around the edges. */
export const MARGIN = { top: 20, right: 6, bottom: 6, left: 6 };
/** The row and column number strips beside the drawing, in screen pixels (they don't scale). */
export const AXIS = { rowGutter: 44, colStrip: 20 };

export const chartSize = (chart: Chart) => ({
  width: chart.width * CELL + MARGIN.left + MARGIN.right,
  height: chart.cells.length * CELL + MARGIN.top + MARGIN.bottom,
});

/** Top edge of chart row `r`, inside the margins. */
export const rowTop = (chart: Chart, r: number) => (chart.cells.length - 1 - (r - (chart.firstRow ?? 1))) * CELL;

/** Left edge of chart column `n`, inside the margins. */
export const colLeft = (chart: Chart, n: number) => (chart.width - n) * CELL;

/** Distance from the drawing's top edge to the middle of chart row `r`, at scale 1. */
export const rowCenter = (chart: Chart, r: number) => MARGIN.top + rowTop(chart, r) + CELL / 2;

/** Distance from the drawing's left edge to the middle of chart column `n`, at scale 1. */
export const colCenter = (chart: Chart, n: number) => MARGIN.left + colLeft(chart, n) + CELL / 2;
