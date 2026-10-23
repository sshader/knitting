import type { Chart } from "../../../shared/schema";
import { symbolFor } from "./symbol";

const CELL = 10;

/** The extracted cells drawn from the legend's swatches; row 1 at the bottom, columns numbered from the right. */
export function ChartGrid({ chart, row, onRow }: { chart: Chart; row: number; onRow: (r: number) => void }) {
  const cols = chart.width;
  const rows = chart.cells.length;
  const first = chart.firstRow ?? 1;
  return (
    <svg className="grid-svg" viewBox={`-18 -12 ${cols * CELL + 22} ${rows * CELL + 14}`}>
      {chart.cells.map((cells, i) => {
        const r = first + i;
        const y = (rows - 1 - i) * CELL;
        return (
          <g key={r} onClick={() => onRow(r)}>
            {[...cells].map((k, c) => {
              const e = chart.legend[k];
              const fill = !e ? "#f0f" : e.noStitch ? "#222" : (e.swatch ?? "#ddd");
              const sym = e ? symbolFor(k, e) : "?";
              return (
                <g key={c}>
                  <rect x={c * CELL} y={y} width={CELL} height={CELL} fill={fill} stroke="#999" strokeWidth={0.3} />
                  {sym && (
                    <text x={c * CELL + CELL / 2} y={y + CELL * 0.75} fontSize={7} textAnchor="middle" fill="#000">
                      {sym}
                    </text>
                  )}
                </g>
              );
            })}
            {(r % 5 === 0 || r === first) && (
              <text x={-3} y={y + CELL * 0.75} fontSize={6} textAnchor="end" fill="#666">
                {r}
              </text>
            )}
          </g>
        );
      })}
      {Array.from({ length: cols }, (_, c) => cols - c).map((n, c) =>
        n % 5 === 0 || n === 1 ? (
          <text key={n} x={c * CELL + CELL / 2} y={-3} fontSize={6} textAnchor="middle" fill="#666">
            {n}
          </text>
        ) : null,
      )}
      <rect x={-1} y={(rows - 1 - (row - first)) * CELL - 1} width={cols * CELL + 2} height={CELL + 2} fill="none" stroke="#e0a100" strokeWidth={2} />
    </svg>
  );
}
