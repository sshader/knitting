import type { ExpandedStep } from "../../../shared/expand";
import { useKnit } from "../KnitContext";
import { ColoredRunText } from "./ColoredRunText";

/**
 * The current step, large: what to work, the chart row written out, and the
 * stitch count, with the previous and next steps for context.
 */
export function InstructionsPanel() {
  const { steps, index, step, charts, go } = useKnit();
  if (!step) return <div className="panel-empty">No steps for this size and options.</div>;
  const chart = step.chart ? charts[step.chart.chartId]?.chart : undefined;
  // With a chart row, the generated row is what to work; the section's text is context.
  const primary = step.chart?.text;

  return (
    <div className="instructions-panel">
      <div className="step-now">
        <div className="step-where">
          <span>{step.section.title}</span>
          {step.of && step.of.count > 1 && (
            <span>
              {step.of.label} · <b>{step.of.index}</b> of {step.of.count}
            </span>
          )}
        </div>
        <StepLabel label={step.label} />
        {step.until && <div className="step-until">Repeat until {step.until.replace(/^until\s+/i, "")}</div>}

        {primary && (
          <div className={`step-primary ${primary.length > 140 ? "long" : ""}`}>
            <ColoredRunText text={primary} chart={chart} />
          </div>
        )}
        {step.instruction && <div className={primary ? "step-context" : "step-primary"}>{step.instruction}</div>}

        {step.also?.map((a) => (
          <div key={a} className="step-also">
            <span className="step-also-tag">At the same time</span> {a}
          </div>
        ))}

        {step.stitches && (
          <div className="step-stitches">
            {step.stitches.before !== undefined && <span className="muted">{step.stitches.before} → </span>}
            <b>{step.stitches.after}</b> sts
          </div>
        )}

        <Checks step={step} />

        {step.related?.map((r, k) => (
          <details key={k} className="step-related" open>
            <summary>{r.title}</summary>
            {r.text}
          </details>
        ))}
      </div>

      <nav className="step-neighbors">
        <Neighbor step={steps[index - 1]} direction="prev" onClick={() => go(index - 1)} />
        <Neighbor step={steps[index + 1]} direction="next" onClick={() => go(index + 1)} />
      </nav>
    </div>
  );
}

/** "Round 3 (increase round)" as the round's name with a badge for the shaping. */
function StepLabel({ label }: { label: string }) {
  const m = /^(.*?)\s*\((increase|decrease) round\)$/.exec(label);
  return (
    <h1 className="step-label">
      {m ? m[1] : label}
      {m && <span className={`shaping ${m[2]}`}>{m[2]}</span>}
    </h1>
  );
}

/** Where the generated step disagrees with the pattern, quietly. */
function Checks({ step }: { step: ExpandedStep }) {
  const notes: string[] = [];
  if (step.statedStitches !== undefined) notes.push(`The pattern says ${step.statedStitches} sts here.`);
  if (step.chart?.written !== undefined && !step.chart.writtenMatches) notes.push(`The pattern writes this row as: ${step.chart.written}`);
  if (notes.length === 0) return null;
  return (
    <ul className="step-checks">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

function Neighbor({ step, direction, onClick }: { step: ExpandedStep | undefined; direction: "prev" | "next"; onClick: () => void }) {
  if (!step) return <div className={`neighbor ${direction} empty`}>{direction === "prev" ? "Start of pattern" : "End of pattern"}</div>;
  return (
    <button className={`neighbor ${direction}`} onClick={onClick}>
      <span className="neighbor-dir">{direction === "prev" ? "← Previous" : "Next →"}</span>
      <span className="neighbor-label">{step.label}</span>
      <span className="neighbor-text">{step.chart?.text ?? step.instruction}</span>
    </button>
  );
}
