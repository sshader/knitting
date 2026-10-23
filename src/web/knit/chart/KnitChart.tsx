import { isRS } from "../../../shared/chartRows";
import type { Chart } from "../../../shared/schema";
import { symbolFor } from "../../inspector/charts/symbol";

/** Cell size in SVG units; the panel scales the whole drawing. */
export const CELL = 16;
/** Room for row numbers (right), column numbers (bottom), and the repeat bracket (top). */
export const MARGIN = { top: 18, right: 48, bottom: 26, left: 22 };

/**
 * A chart as the knitter reads it: row 1 at the bottom, columns numbered from
 * the right. Light lines between cells and heavier ones every 5 stitches and
 * rows; the current row is outlined, with an arrow where it starts (when
 * drawn large enough to see), and the rows around it are dimmed.
 */
export function KnitChart({
  chart,
  row,
  upcomingRow,
  run,
  scale,
  onRow,
}: {
  chart: Chart;
  /** The row being worked; everything else is dimmed. */
  row: number | null;
  /** With no current row, the row coming up next, marked lightly. */
  upcomingRow: number | null;
  /** In the current row, the columns of the run being worked (1 = rightmost). */
  run?: { from: number; to: number };
  scale: number;
  onRow: (r: number) => void;
}) {
  const cols = chart.width;
  const rows = chart.cells.length;
  const first = chart.firstRow ?? 1;
  const width = cols * CELL;
  const height = rows * CELL;
  /** Top edge of chart row `r`. */
  const yOf = (r: number) => (rows - 1 - (r - first)) * CELL;
  /** Left edge of chart column `n` (1 = rightmost). */
  const xOf = (n: number) => (cols - n) * CELL;

  const rowNumbers = Array.from({ length: rows }, (_, i) => first + i);
  const colNumbers = Array.from({ length: cols }, (_, i) => i + 1);
  // Numbers stay about 10px on screen however small the chart is drawn; when that's
  // taller than a row, only every 5th row (and the current one) is numbered.
  const labelSize = Math.min(20, Math.max(5, 10 / scale));
  const everyRow = labelSize <= CELL * 0.85;

  return (
    <svg
      className="knit-chart"
      viewBox={`${-MARGIN.left} ${-MARGIN.top} ${width + MARGIN.left + MARGIN.right} ${height + MARGIN.top + MARGIN.bottom}`}
      width={chartSize(chart).width * scale}
      height={chartSize(chart).height * scale}
    >
      {chart.cells.map((cells, i) => {
        const r = first + i;
        return (
          <g key={r} onClick={() => onRow(r)} className="chart-row">
            {[...cells].map((k, c) => {
              const e = chart.legend[k];
              const fill = !e ? "#f0f" : e.noStitch ? "var(--chart-no-stitch)" : (e.swatch ?? "#ddd");
              const sym = e ? symbolFor(k, e) : "?";
              return (
                <g key={c}>
                  <rect x={c * CELL} y={yOf(r)} width={CELL} height={CELL} fill={fill} />
                  {sym && (
                    <text x={c * CELL + CELL / 2} y={yOf(r) + CELL * 0.72} className="cell-symbol" textAnchor="middle">
                      {sym}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      <Gridlines cols={cols} rows={rows} first={first} />

      {chart.repeat && <RepeatBracket x0={xOf(chart.repeat.toCol)} x1={xOf(chart.repeat.fromCol) + CELL} labelSize={Math.min(labelSize, 12)} />}

      {rowNumbers
        .filter((r) => everyRow || r === row || ((r === first || r % 5 === 0) && (row === null || Math.abs(r - row) > 2)))
        .map((r) => (
          <text key={r} x={width + 4} y={yOf(r) + CELL / 2} dominantBaseline="central" fontSize={labelSize} className={`axis-label ${r === row ? "current" : ""}`}>
            {r}
          </text>
        ))}
      {colNumbers
        .filter((n) => n === 1 || n % 5 === 0)
        .map((n) => (
          <text key={n} x={xOf(n) + CELL / 2} y={height + 4 + labelSize} fontSize={labelSize} className="axis-label" textAnchor="middle">
            {n}
          </text>
        ))}

      {row !== null && (
        <>
          {/* Dim everything but the current row. */}
          <rect x={-1} y={-1} width={width + 2} height={yOf(row) + 1} className="chart-dim" />
          <rect x={-1} y={yOf(row) + CELL} width={width + 2} height={height - yOf(row) - CELL + 1} className="chart-dim" />
          <rect x={-1.5} y={yOf(row) - 1.5} width={width + 3} height={CELL + 3} className="chart-current" vectorEffect="non-scaling-stroke" />
          {run && (
            <rect x={xOf(run.to) - 1} y={yOf(row) - 3} width={xOf(run.from) - xOf(run.to) + CELL + 2} height={CELL + 6} className="chart-run" vectorEffect="non-scaling-stroke" />
          )}
          {scale >= 0.8 && <DirectionArrow rs={isRS(chart, row)} y={yOf(row) + CELL / 2} width={width} />}
        </>
      )}
      {row === null && upcomingRow !== null && <rect x={-1.5} y={yOf(upcomingRow) - 1.5} width={width + 3} height={CELL + 3} className="chart-upcoming" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** The drawing's size at scale 1, margins included. */
export const chartSize = (chart: Chart) => ({
  width: chart.width * CELL + MARGIN.left + MARGIN.right,
  height: chart.cells.length * CELL + MARGIN.top + MARGIN.bottom,
});

/** Distance from the drawing's top edge to the middle of chart row `r`, at scale 1. */
export const rowCenter = (chart: Chart, r: number) => MARGIN.top + (chart.cells.length - 1 - (r - (chart.firstRow ?? 1))) * CELL + CELL / 2;

/** Thin lines between every cell; heavier every 5 stitches (from the right) and every 5 rows (from the bottom). */
function Gridlines({ cols, rows, first }: { cols: number; rows: number; first: number }) {
  const width = cols * CELL;
  const height = rows * CELL;
  const vertical = Array.from({ length: cols + 1 }, (_, c) => ({ x: c * CELL, major: (cols - c) % 5 === 0 || c === 0 }));
  // Line i (counting down from the top edge) runs along the top of row `first + rows - 1 - i`;
  // it's major on top of rows 5, 10, ... (between rows 5 and 6, and so on).
  const horizontal = Array.from({ length: rows + 1 }, (_, i) => {
    const rowBelow = first + rows - 1 - i;
    return { y: i * CELL, major: i === 0 || i === rows || rowBelow % 5 === 0 };
  });
  return (
    <g className="gridlines">
      {vertical.map(({ x, major }) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} className={major ? "major" : "minor"} />
      ))}
      {horizontal.map(({ y, major }) => (
        <line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} className={major ? "major" : "minor"} />
      ))}
    </g>
  );
}

function RepeatBracket({ x0, x1, labelSize }: { x0: number; x1: number; labelSize: number }) {
  return (
    <g className="repeat-bracket">
      <path d={`M ${x0} -4 V -10 H ${x1} V -4`} />
      <text x={(x0 + x1) / 2} y={-12} fontSize={labelSize} textAnchor="middle">
        repeat
      </text>
    </g>
  );
}

/** Where the current row starts and which way it goes: RS rows right to left, WS rows left to right. */
function DirectionArrow({ rs, y, width }: { rs: boolean; y: number; width: number }) {
  const path = rs ? `M ${width + 46} ${y} h -10 m 0 0 l 5 -5 m -5 5 l 5 5` : `M -20 ${y} h 10 m 0 0 l -5 -5 m 5 5 l -5 5`;
  return <path d={path} className="direction-arrow" />;
}
