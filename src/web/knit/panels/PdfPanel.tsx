import { useLayoutEffect, useRef, useState } from "react";
import { union, type BBox } from "../../../extract/pageData";
import { PdfChart } from "../../inspector/charts/PdfChart";
import { boxStyle } from "../../inspector/shared/box";
import { useQuoteBoxes } from "../../inspector/shared/useQuoteBoxes";
import { useKnit } from "../KnitContext";
import { useIsPhone } from "../useIsPhone";

/** A little room around the lines so the box doesn't sit on the letters. */
const pad = (b: BBox): BBox => [b[0] - 0.012, b[1] - 0.006, b[2] + 0.012, b[3] + 0.006];

/**
 * The pattern itself: the page the current step comes from with its lines
 * boxed, or, for chart rows, the chart as printed with the row marked.
 * "Zoom to step" enlarges the page until those lines fill the width, which
 * is what makes a page readable on a phone (and the default there).
 */
export function PdfPanel() {
  const { steps, index, step, pages, charts } = useKnit();
  const phone = useIsPhone();
  const [show, setShow] = useState<"page" | "chart">("page");
  const [zoomed, setZoomed] = useState(phone);
  const chart = step?.chart ? charts[step.chart.chartId] : undefined;
  const view = chart && show === "chart" ? "chart" : "page";

  // Steps without a source of their own (rare) show the last step's.
  let from = index;
  while (from > 0 && !steps[from]?.source.length) from--;
  const sources = steps[from]?.source ?? [];
  const quotes = useQuoteBoxes(pages, sources);
  const page = pages.find((p) => p.page === sources[0]?.page);
  const lines = quotes.filter((q) => q.page === page?.page && q.lines).map((q) => q.lines!);
  const spot = lines.length ? pad(union(lines)) : null;
  // How much wider than the panel to draw the page so the step's lines fill it.
  const scale = zoomed && spot ? Math.min(4, Math.max(1, 0.94 / (spot[2] - spot[0]))) : 1;

  // Bring the box a third of the way down the view (and centred across it when
  // zoomed); again once the image has loaded and has a height.
  const scroller = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const scrollToSpot = () => {
    const el = scroller.current;
    const box = spotRef.current?.getBoundingClientRect();
    if (!el || !box) return;
    const frame = el.getBoundingClientRect();
    el.scrollTo({
      top: box.top - frame.top + el.scrollTop - el.clientHeight / 3,
      left: box.left - frame.left + el.scrollLeft - (el.clientWidth - box.width) / 2,
      behavior: "smooth",
    });
  };
  useLayoutEffect(scrollToSpot, [spot?.[0], spot?.[1], page?.page, view, scale]);

  return (
    <div className="pdf-panel">
      <header className="panel-bar">
        <span className="segmented">
          <button className={view === "page" ? "on" : ""} onClick={() => setShow("page")}>
            Page {page?.page ?? ""}
          </button>
          <button className={view === "chart" ? "on" : ""} disabled={!chart} onClick={() => setShow("chart")}>
            Chart
          </button>
        </span>
        {from !== index && <span className="muted">from {steps[from].label}</span>}
        {view === "page" && spot && (
          <button className="zoom-to-step" onClick={() => setZoomed(!zoomed)}>
            {zoomed ? "Whole page" : "Zoom to step"}
          </button>
        )}
      </header>
      <div className="pdf-scroll" ref={scroller}>
        {view === "chart" && chart && step?.chart ? (
          <PdfChart c={chart} row={step.chart.row} onRow={() => {}} />
        ) : page ? (
          <div className="page" style={{ width: `calc(${scale * 100}% - 16px)` }}>
            <img src={page.pngUrl} alt={`page ${page.page}`} onLoad={scrollToSpot} />
            {spot && (
              <div ref={spotRef} className="source-spot" style={boxStyle(spot)}>
                <span className="source-pointer" />
              </div>
            )}
          </div>
        ) : (
          <div className="panel-empty">No source for this step.</div>
        )}
      </div>
    </div>
  );
}
