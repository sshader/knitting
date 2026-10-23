import { isRS } from "../../../shared/chartRows";
import type { Chart } from "../../../shared/schema";
import { colCenter, rowCenter } from "./geometry";

/** Labels stay this size on screen at any zoom; a row is numbered only when there's room. */
const LABEL_PX = 11;

/**
 * Row numbers down the right edge. Pinned to the panel's right side so they
 * stay in view when a wide chart is scrolled; the current row is bold, with
 * an arrow for the direction it's worked.
 */
export function RowAxis({ chart, scale, row }: { chart: Chart; scale: number; row: number | null }) {
  const first = chart.firstRow ?? 1;
  const rowPx = 16 * scale;
  // Leave out labels that would crowd each other, or the current row's.
  const every = rowPx >= LABEL_PX + 2 ? 1 : 5;
  const clearOfCurrent = Math.ceil((LABEL_PX + 2) / rowPx);
  const shown = chart.cells
    .map((_, i) => first + i)
    .filter((r) => r === row || ((r === first || r % every === 0) && (row === null || Math.abs(r - row) >= clearOfCurrent)));
  return (
    <div className="row-axis">
      {shown.map((r) => (
        <span key={r} className={r === row ? "current" : ""} style={{ top: rowCenter(chart, r) * scale }}>
          {r}
          {r === row && <span className="direction">{isRS(chart, r) ? "←" : "→"}</span>}
        </span>
      ))}
    </div>
  );
}

/** Column numbers along the bottom, counted from the right; pinned to the panel's bottom edge. */
export function ColAxis({ chart, scale }: { chart: Chart; scale: number }) {
  const every = 16 * scale * 5 >= 22 ? 5 : 10;
  const shown = Array.from({ length: chart.width }, (_, i) => i + 1).filter((n) => n === 1 || n % every === 0);
  return (
    <div className="col-axis">
      {shown.map((n) => (
        <span key={n} style={{ left: colCenter(chart, n) * scale }}>
          {n}
        </span>
      ))}
    </div>
  );
}
