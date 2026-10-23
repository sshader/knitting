import type { Chart } from "../../../shared/schema";
import { symbolFor } from "../../inspector/charts/symbol";
import { ColAxis, RowAxis } from "./ChartAxes";
import { AXIS, CELL, chartSize, colLeft, MARGIN, rowTop } from "./geometry";

/**
 * A chart as the knitter reads it: row 1 at the bottom, columns numbered from
 * the right. Light lines between cells and heavier ones every 5 stitches and
 * rows; the current row is outlined and the rows around it are dimmed. Row
 * and column numbers sit in strips that stay put while the chart scrolls.
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
  const size = chartSize(chart);
  return (
    <div className="chart-canvas" style={{ gridTemplateColumns: `${size.width * scale}px ${AXIS.rowGutter}px`, gridTemplateRows: `${size.height * scale}px ${AXIS.colStrip}px` }}>
      <ChartDrawing chart={chart} row={row} upcomingRow={upcomingRow} run={run} scale={scale} onRow={onRow} />
      <RowAxis chart={chart} scale={scale} row={row} />
      <ColAxis chart={chart} scale={scale} />
      <div className="axis-corner" />
    </div>
  );
}

function ChartDrawing({ chart, row, upcomingRow, run, scale, onRow }: Parameters<typeof KnitChart>[0]) {
  const width = chart.width * CELL;
  const height = chart.cells.length * CELL;
  const first = chart.firstRow ?? 1;
  const yOf = (r: number) => rowTop(chart, r);
  const xOf = (n: number) => colLeft(chart, n);
  const size = chartSize(chart);

  return (
    <svg className="knit-chart" viewBox={`${-MARGIN.left} ${-MARGIN.top} ${size.width} ${size.height}`} width={size.width * scale} height={size.height * scale}>
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

      <Gridlines chart={chart} />

      {chart.repeat && <RepeatBracket x0={xOf(chart.repeat.toCol)} x1={xOf(chart.repeat.fromCol) + CELL} labelSize={11 / scale} />}

      {row !== null && (
        <>
          {/* Dim everything but the current row. */}
          <rect x={-1} y={-1} width={width + 2} height={yOf(row) + 1} className="chart-dim" />
          <rect x={-1} y={yOf(row) + CELL} width={width + 2} height={height - yOf(row) - CELL + 1} className="chart-dim" />
          <rect x={-1.5} y={yOf(row) - 1.5} width={width + 3} height={CELL + 3} className="chart-current" vectorEffect="non-scaling-stroke" />
          {run && (
            <rect x={xOf(run.to) - 1} y={yOf(row) - 3} width={xOf(run.from) - xOf(run.to) + CELL + 2} height={CELL + 6} className="chart-run" vectorEffect="non-scaling-stroke" />
          )}
        </>
      )}
      {row === null && upcomingRow !== null && (
        <rect x={-1.5} y={yOf(upcomingRow) - 1.5} width={width + 3} height={CELL + 3} className="chart-upcoming" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/** Thin lines between every cell; heavier every 5 stitches (from the right) and every 5 rows (from the bottom). */
function Gridlines({ chart }: { chart: Chart }) {
  const cols = chart.width;
  const rows = chart.cells.length;
  const first = chart.firstRow ?? 1;
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
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={rows * CELL} className={major ? "major" : "minor"} />
      ))}
      {horizontal.map(({ y, major }) => (
        <line key={`h${y}`} x1={0} y1={y} x2={cols * CELL} y2={y} className={major ? "major" : "minor"} />
      ))}
    </g>
  );
}

function RepeatBracket({ x0, x1, labelSize }: { x0: number; x1: number; labelSize: number }) {
  return (
    <g className="repeat-bracket">
      <path d={`M ${x0} -3 V -8 H ${x1} V -3`} vectorEffect="non-scaling-stroke" />
      <text x={(x0 + x1) / 2} y={-10} fontSize={labelSize} textAnchor="middle">
        repeat
      </text>
    </g>
  );
}
