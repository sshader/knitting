import { useLayoutEffect, useRef, useState } from "react";
import { PdfChart } from "../../inspector/charts/PdfChart";
import { union, type BBox } from "../../../extract/pageData";
import { boxStyle } from "../../inspector/shared/box";
import { useQuoteBoxes } from "../../inspector/shared/useQuoteBoxes";
import { useKnit } from "../KnitContext";

/**
 * The pattern itself: the page the current step comes from with its words
 * highlighted, or, for chart rows, the chart as printed with the row marked.
 */
/** A little room around the lines so the box doesn't sit on the letters. */
const pad = (b: BBox): BBox => [b[0] - 0.012, b[1] - 0.006, b[2] + 0.012, b[3] + 0.006];

export function PdfPanel() {
  const { steps, index, step, pages, charts } = useKnit();
  const [show, setShow] = useState<"page" | "chart">("page");
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

  // Bring the highlight a third of the way down the view; again once the image has a height.
  const scroller = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const scrollToHighlight = () => {
    const el = scroller.current;
    const hl = spotRef.current;
    if (!el || !hl) return;
    const top = hl.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTo({ top: top - el.clientHeight / 3, behavior: "smooth" });
  };
  useLayoutEffect(scrollToHighlight, [spot?.[1], page?.page, view]);

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
      </header>
      <div className="pdf-scroll" ref={scroller}>
        {view === "chart" && chart && step?.chart ? (
          <PdfChart c={chart} row={step.chart.row} onRow={() => {}} />
        ) : page ? (
          <div className="page">
            <img src={page.pngUrl} alt={`page ${page.page}`} onLoad={scrollToHighlight} />
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
