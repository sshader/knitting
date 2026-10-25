import { useEffect, useRef, useState } from "react";
import { useKnit } from "../KnitContext";
import { useNotes } from "./useNotes";

const SAVE_DELAY_MS = 600;

/**
 * The note for an instruction (or the project, with a null node), saved as
 * you type. Collapsed to an "Add a note" button until there's something in it.
 */
export function NoteEditor({ node, placeholder }: { node: string | null; placeholder: string }) {
  const { project } = useKnit();
  const { notes, save } = useNotes(project._id);
  if (notes === undefined) return null;
  const saved = notes.find((n) => n.node === node)?.text ?? "";
  // Keyed by node, so moving to another instruction starts from that one's note.
  return <Editor key={node ?? ""} saved={saved} placeholder={placeholder} onSave={(text) => save(node, text)} />;
}

function Editor({ saved, placeholder, onSave }: { saved: string; placeholder: string; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(saved);
  const [open, setOpen] = useState(saved !== "");
  const pending = useRef<{ timer: number; text: string } | null>(null);
  const flush = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    onSave(pending.current.text);
    pending.current = null;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  // Save what's typed when leaving the instruction mid-pause.
  useEffect(() => () => flushRef.current(), []);

  if (!open) {
    return (
      <button className="note-add quiet" onClick={() => setOpen(true)}>
        + Add a note
      </button>
    );
  }
  return (
    <textarea
      className="note-editor"
      value={draft}
      placeholder={placeholder}
      autoFocus={saved === ""}
      rows={Math.min(10, Math.max(2, draft.split("\n").length))}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (pending.current) clearTimeout(pending.current.timer);
        pending.current = { text, timer: window.setTimeout(flush, SAVE_DELAY_MS) };
      }}
      onBlur={() => {
        flush();
        if (!draft.trim()) setOpen(false);
      }}
    />
  );
}
