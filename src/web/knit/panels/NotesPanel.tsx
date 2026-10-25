import { useKnit } from "../KnitContext";
import { CounterList } from "../notes/CounterList";
import { NoteEditor } from "../notes/NoteEditor";
import { useNotes } from "../notes/useNotes";

/** The project's own counters and note, and every instruction's note in pattern order, to jump back to. */
export function NotesPanel() {
  const { project, steps, go } = useKnit();
  const { notes } = useNotes(project._id);
  // Each instruction's first step, in pattern order.
  const stepNotes = steps.flatMap((s, i) => {
    if (i > 0 && steps[i - 1].node === s.node) return [];
    const note = notes?.find((n) => n.node === s.node);
    return note ? [{ step: s, index: i, text: note.text }] : [];
  });

  return (
    <div className="notes-panel">
      <section>
        <h3>Project counters</h3>
        <CounterList node={null} />
      </section>
      <section>
        <h3>Project notes</h3>
        <NoteEditor node={null} placeholder="Yarn, needles, gauge, modifications…" />
      </section>
      {stepNotes.length > 0 && (
        <section>
          <h3>Notes on steps</h3>
          <ul className="step-notes">
            {stepNotes.map(({ step, index, text }) => (
              <li key={step.node}>
                <button className="quiet" onClick={() => go(index)}>
                  <span className="muted">
                    {step.section.title} · {step.of && step.of.count > 1 ? step.of.label : step.label}
                  </span>
                  <span className="step-note-text">{text}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
