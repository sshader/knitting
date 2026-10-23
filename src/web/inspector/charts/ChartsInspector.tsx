import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { chartReport } from "../../../extract/chartReport";
import { ChartDetails } from "./ChartDetails";
import { ChartGrid } from "./ChartGrid";
import { ChartRowList } from "./ChartRowList";
import { PdfChart } from "./PdfChart";

/**
 * Reviewing chart extraction: the chart image from the PDF, the grid rebuilt
 * from it, and the generated row-by-row instructions, side by side.
 * Selecting a row (click anywhere, or j/k) highlights it in all three.
 */
export function ChartsInspector() {
  const charts = useQuery(api.charts.list);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const c = charts?.find((x) => x._id === selectedId) ?? charts?.[0];
  const reports = useMemo(() => new Map(charts?.map((x) => [x._id, chartReport(x.chart)])), [charts]);
  const report = c && reports.get(c._id);

  const first = c?.chart.firstRow ?? 1;
  const last = c ? first + c.chart.cells.length - 1 : 1;
  const [chosenRow, setRow] = useState(first);
  const row = Math.min(last, Math.max(first, chosenRow));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "ArrowUp") setRow((r) => Math.min(last, r + 1));
      if (e.key === "j" || e.key === "ArrowDown") setRow((r) => Math.max(first, r - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, last]);

  return (
    <div className="inspector">
      <aside>
        <h1>Charts</h1>
        {charts?.length === 0 && <p className="muted small">No charts yet. Run: npx tsx scripts/charts.ts &lt;pattern&gt;</p>}
        <ul>
          {charts?.map((x) => {
            const w = reports.get(x._id)?.written;
            return (
              <li key={x._id} className={x._id === c?._id ? "active" : ""} onClick={() => (setSelectedId(x._id), setRow(x.chart.firstRow ?? 1))}>
                <div className="name">{x.chart.title}</div>
                <div className="meta">
                  {x.pattern} · {x.chart.width}x{x.chart.cells.length}
                  {w && <span className={w.identical === w.rows ? "good" : "bad"}> · {w.identical}/{w.rows} rows match written</span>}
                </div>
              </li>
            );
          })}
        </ul>
        {c && report && <ChartDetails c={c} written={report.written} />}
      </aside>
      {c && report && (
        <main className="charts-main">
          <section>
            <h3>PDF</h3>
            <PdfChart c={c} row={row} onRow={setRow} />
          </section>
          <section>
            <h3>Rebuilt grid</h3>
            <ChartGrid chart={c.chart} row={row} onRow={setRow} />
          </section>
          <section className="rows-pane">
            <h3>
              Rows{" "}
              {report.written && (
                <span className="small muted">
                  {report.written.identical}/{report.written.rows} match the written rows · {report.written.stitchesDiffering} stitches differ
                </span>
              )}
            </h3>
            <ChartRowList rows={report.rows} row={row} onRow={setRow} />
          </section>
        </main>
      )}
    </div>
  );
}
