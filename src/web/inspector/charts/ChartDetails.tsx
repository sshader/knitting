import type { WrittenComparison } from "../../../extract/chartReport";
import type { ChartRow } from "../shared/types";
import { symbolFor } from "./symbol";

/** Sidebar for the selected chart: its legend, the model's notes, and the checks. */
export function ChartDetails({ c, written }: { c: ChartRow; written: WrittenComparison | null }) {
  const { problems, checkpoints } = c.stitchCounts;
  return (
    <>
      <h3>Legend</h3>
      <ul className="legend-list">
        {Object.entries(c.chart.legend).map(([k, e]) => (
          <li key={k}>
            <span className="swatch" style={{ background: e.noStitch ? "#222" : e.swatch }}>
              {symbolFor(k, e)}
            </span>
            {e.label}
          </li>
        ))}
      </ul>
      {c.chart.cellNote && <p className="small">{c.chart.cellNote}</p>}
      <details className="small">
        <summary>Model notes</summary>
        <ul>
          {c.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
      <h3>Checks</h3>
      <ul className="small">
        {c.unassignedCells > 0 && <li className="bad">{c.unassignedCells} cells not assigned to a legend entry</li>}
        <li className={problems.length ? "bad" : "good"}>
          Stitch counts: {checkpoints.length} checkpoints from the sections, {problems.length ? `${problems.length} problems` : "all consistent"}
        </li>
        {problems.map((p) => (
          <li key={p} className="bad">
            {p}
          </li>
        ))}
        {written && (
          <li className={written.identical === written.rows ? "good" : "bad"}>
            Written rows: {written.identical}/{written.rows} identical
          </li>
        )}
      </ul>
      <p className="small muted">j/k or ↓/↑ to move between rows</p>
    </>
  );
}
