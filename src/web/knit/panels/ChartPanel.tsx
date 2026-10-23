import { useLayoutEffect, useRef, useState } from "react";
import { isRS } from "../../../shared/chartRows";
import { ChartLegend } from "../chart/ChartLegend";
import { AXIS, chartSize, rowCenter } from "../chart/geometry";
import { KnitChart } from "../chart/KnitChart";
import { useKnit } from "../KnitContext";
import { runsForStep } from "../rowRuns";
import { chartFocus, stepForChartRow } from "../steps";
import { useElementWidth } from "../useElementWidth";

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/**
 * The chart for the current step with its row picked out, or the chart
 * coming up next. Fits the panel's width until you zoom; keeps the current
 * row in the middle of the view. Clicking a row jumps to that row's step.
 */
export function ChartPanel() {
  const { steps, index, step, position, charts, go } = useKnit();
  const focus = chartFocus(steps, index);
  const marked = position.mark && runsForStep(step, charts)?.runs[position.mark.run];
  const c = focus ? charts[focus.chartId] : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const width = useElementWidth(scroller);
  const [zoom, setZoom] = useState<number | "fit">("fit");

  const fit = c ? Math.max(0.2, Math.min(3, (width - 16 - AXIS.rowGutter) / chartSize(c.chart).width)) : 1;
  const scale = zoom === "fit" ? fit : zoom;

  // Keep the current row (or the one coming up) in the middle of the view.
  const target = focus?.row ?? focus?.upcoming?.row ?? null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !c || target === null) return;
    el.scrollTo({ top: rowCenter(c.chart, target) * scale - el.clientHeight / 2, behavior: "smooth" });
  }, [c, target, scale]);

  if (!focus || !c) return <div className="panel-empty">This pattern has no charts.</div>;
  const zoomIn = () => setZoom(ZOOMS.find((z) => z > scale + 0.01) ?? ZOOMS[ZOOMS.length - 1]);
  const zoomOut = () => setZoom([...ZOOMS].reverse().find((z) => z < scale - 0.01) ?? ZOOMS[0]);

  return (
    <div className="chart-panel">
      <header className="panel-bar">
        <b>{c.chart.title}</b>
        <span className="muted">
          {focus.row !== null
            ? `Row ${focus.row} of ${(c.chart.firstRow ?? 1) + c.chart.cells.length - 1} · read ${isRS(c.chart, focus.row) ? "right to left ←" : "left to right →"}`
            : focus.upcoming ? `Starts at ${steps[focus.upcoming.step].label} (row ${focus.upcoming.row})` : "Not on this step"}
        </span>
        <span className="zoom">
          <button onClick={zoomOut} aria-label="Zoom out">
            −
          </button>
          <button className={zoom === "fit" ? "on" : ""} onClick={() => setZoom("fit")}>
            Fit
          </button>
          <button onClick={zoomIn} aria-label="Zoom in">
            +
          </button>
        </span>
      </header>
      <div className="chart-scroll" ref={scroller}>
        <KnitChart
          chart={c.chart}
          row={focus.row}
          upcomingRow={focus.upcoming?.row ?? null}
          run={marked?.cols}
          scale={scale}
          onRow={(r) => {
            const j = stepForChartRow(steps, index, c.chartId, r);
            if (j !== null) go(j);
          }}
        />
      </div>
      <footer className="chart-legend-bar">
        <ChartLegend chart={c.chart} />
      </footer>
    </div>
  );
}
