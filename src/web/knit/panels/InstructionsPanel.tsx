import type { ExpandedStep } from "../../../shared/expand";
import { useKnit } from "../KnitContext";
import * as nav from "../navigation";
import { runsForStep } from "../rowRuns";
import { GlossaryText } from "./GlossaryText";
import { RepeatUntil } from "./RepeatUntil";
import { RowRunsView } from "./RowRunsView";

/**
 * The current step, large: what to work, the chart row written out, and the
 * stitch count, with the previous and next steps for context.
 */
export function InstructionsPanel() {
  const { steps, index, step, charts, position, prev, next, setMark } = useKnit();
  if (!step) return <div className="panel-empty">No steps for this size and options.</div>;
  const chart = step.chart ? charts[step.chart.chartId]?.chart : undefined;
  // With a chart row, the generated row is what to work; the section's text is context.
  const row = runsForStep(step, charts);

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
        <RepeatUntil />

        {row && chart && (
          <div className={`step-primary ${(step.chart?.text.length ?? 0) > 140 ? "long" : ""}`}>
            <RowRunsView runs={row.runs} layout={row.layout} mark={position.mark} chart={chart} onMark={setMark} />
          </div>
        )}
        {step.instruction && (
          <div className={row ? "step-context" : "step-primary"}>
            <GlossaryText text={step.instruction} />
          </div>
        )}

        {step.also?.map((a) => (
          <div key={a} className="step-also">
            <span className="step-also-tag">At the same time</span> <GlossaryText text={a} />
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
            <GlossaryText text={r.text} />
          </details>
        ))}
      </div>

      <nav className="step-neighbors">
        <Neighbor step={index > 0 || position.pass ? steps[nav.prev(steps, position).step] : undefined} direction="prev" onClick={prev} />
        <Neighbor step={index < steps.length - 1 || nav.untilBlock(steps, index) ? steps[nav.next(steps, position).step] : undefined} direction="next" onClick={next} />
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
