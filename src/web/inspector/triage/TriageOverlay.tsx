import type { PageTriage } from "../../../extract/triage";
import { boxStyle } from "../shared/box";

/** Detected images and chart regions drawn over a page. */
export function TriageOverlay({ triage }: { triage: PageTriage }) {
  return (
    <>
      {triage.images.map((im, i) => (
        <div key={`i${i}`} className="box raster" style={boxStyle(im.bbox)} title={`image ${Math.round(im.coverage * 100)}%`} />
      ))}
      {triage.charts.map((c, i) => (
        <div key={`c${i}`} className={`box ${c.form}`} style={boxStyle(c.bbox)} title={c.evidence} />
      ))}
    </>
  );
}
