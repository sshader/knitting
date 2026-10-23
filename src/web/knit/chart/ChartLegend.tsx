import type { Chart } from "../../../shared/schema";
import { symbolFor } from "../../inspector/charts/symbol";

/** The symbols this chart uses: how each cell looks, what it's called, and the stitch to work on each side. */
export function ChartLegend({ chart }: { chart: Chart }) {
  const used = new Set(chart.cells.join(""));
  const flat = chart.readDirection === "alternate";
  return (
    <ul className="chart-legend">
      {Object.entries(chart.legend)
        .filter(([k]) => used.has(k))
        .map(([k, e]) => (
          <li key={k}>
            <svg className="legend-cell" viewBox="0 0 16 16" width={22} height={22}>
              <rect x={0.5} y={0.5} width={15} height={15} fill={e.noStitch ? "var(--chart-no-stitch)" : (e.swatch ?? "#ddd")} />
              <text x={8} y={11.5} className="cell-symbol" textAnchor="middle">
                {symbolFor(k, e)}
              </text>
            </svg>
            <span className="legend-text">
              <span className="legend-label">{e.label}</span>
              <span className="legend-stitch">
                {e.noStitch
                  ? "no stitch — skip"
                  : flat && e.ws && e.ws !== e.rs
                    ? `RS ${e.rs ?? e.label} · WS ${e.ws}`
                    : (e.rs ?? "")}
                {e.color && ` · ${e.color}`}
              </span>
            </span>
          </li>
        ))}
    </ul>
  );
}
