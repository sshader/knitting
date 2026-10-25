import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** A project's notes, and a save that shows at once (optimistic) and writes in the background. */
export function useNotes(projectId: Id<"projects">) {
  const notes = useQuery(api.notes.list, { projectId });
  const save = useMutation(api.notes.save);
  const optimisticSave = useMemo(
    () =>
      save.withOptimisticUpdate((store, { projectId, node, text }) => {
        const current = store.getQuery(api.notes.list, { projectId });
        if (!current) return;
        const others = current.filter((n) => n.node !== node);
        const existing = current.find((n) => n.node === node);
        if (!text.trim()) return store.setQuery(api.notes.list, { projectId }, others);
        // A new note gets a placeholder id until the server's version arrives.
        const note = existing ? { ...existing, text } : { _id: crypto.randomUUID() as Id<"notes">, _creationTime: Date.now(), projectId, node, text };
        store.setQuery(api.notes.list, { projectId }, [...others, note]);
      }),
    [save],
  );
  return { notes, save: (node: string | null, text: string) => optimisticSave({ projectId, node, text }) };
}
