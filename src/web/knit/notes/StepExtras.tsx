import { useKnit } from "../KnitContext";
import { CounterList } from "./CounterList";
import { NoteEditor } from "./NoteEditor";

/**
 * Under the current step: counters and a note for its instruction. They belong
 * to the instruction, not the single row, so "Rounds 2-48" keeps one set
 * across all 47 rounds.
 */
export function StepExtras() {
  const { step } = useKnit();
  if (!step) return null;
  return (
    <section className="step-extras">
      <span className="step-also-tag">{step.of && step.of.count > 1 ? `For all of ${step.of.label}` : "For this step"}</span>
      <CounterList node={step.node} />
      <NoteEditor node={step.node} placeholder="A note for this instruction: changes you made, what to watch for…" />
    </section>
  );
}
