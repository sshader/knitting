import type { ExpandedStep } from "../../../shared/expand";

/** One step as the knitter would see it: where they are, what to do, the chart row, and stitch counts. */
export function StepCard({ step }: { step: ExpandedStep }) {
  return (
    <div className="step-card">
      <div className="step-where">
        {step.section.title}
        {step.of && (
          <>
            {" "}
            · step {step.of.index} of {step.of.count} in <i>{step.of.label}</i>
          </>
        )}
      </div>
      <h2>{step.label}</h2>
      {step.until && <div className="step-until">Repeat until {step.until.replace(/^until\s+/i, "")}</div>}
      {step.chart && (
        <div className="step-chart-row">
          <div className="step-chart-text">{step.chart.text}</div>
          <div className="small muted">
            Chart row {step.chart.row} · {step.chart.perRepeat} sts per {step.chart.repeats ? "repeat" : "round"}
            {step.chart.written !== undefined &&
              (step.chart.writtenMatches ? (
                <span className="good"> · ✓ matches the pattern's written round{/CDD|k2tog/.test(step.chart.text) ? " (each decrease counted as 1 st)" : ""}</span>
              ) : (
                <span className="bad"> · differs from the pattern's written round: {step.chart.written}</span>
              ))}
          </div>
        </div>
      )}
      {step.also?.map((a) => (
        <div key={a} className="step-also">
          At the same time: {a}
        </div>
      ))}
      <div className="step-instruction">{step.instruction}</div>
      {step.stitches && (
        <div className="step-stitches">
          {step.stitches.before !== undefined ? `${step.stitches.before} → ` : ""}
          <b>{step.stitches.after} sts</b>
          {step.statedStitches !== undefined && <span className="bad"> · the pattern says {step.statedStitches} sts here</span>}
        </div>
      )}
      {step.related?.map((r, k) => (
        <details key={k} className="step-related" open>
          <summary>{r.title}</summary>
          {r.text}
        </details>
      ))}
    </div>
  );
}
