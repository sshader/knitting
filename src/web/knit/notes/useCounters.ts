import type { OptimisticLocalStore } from "convex/browser";
import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

/**
 * A project's counters and how to change them. Counting and editing show at
 * once (optimistic); a new counter appears when the server has it.
 */
export function useCounters(projectId: Id<"projects">) {
  const counters = useQuery(api.counters.list, { projectId });
  const add = useMutation(api.counters.add);
  const bump = useMutation(api.counters.bump);
  const update = useMutation(api.counters.update);
  const remove = useMutation(api.counters.remove);

  return useMemo(() => {
    const edit = (store: OptimisticLocalStore, counterId: Id<"counters">, change: (c: Doc<"counters">) => Doc<"counters"> | null) => {
      const current = store.getQuery(api.counters.list, { projectId });
      if (!current) return;
      const next = current.flatMap((c) => (c._id === counterId ? (change(c) ?? []) : [c]));
      store.setQuery(api.counters.list, { projectId }, next);
    };
    return {
      counters,
      add: (node: string | null, label: string) => void add({ projectId, node, label }),
      bump: bump.withOptimisticUpdate((store, { counterId, by }) => edit(store, counterId, (c) => ({ ...c, count: Math.max(0, c.count + by) }))),
      update: update.withOptimisticUpdate((store, { counterId, label, count }) =>
        edit(store, counterId, (c) => ({ ...c, ...(label !== undefined && { label }), ...(count !== undefined && { count }) })),
      ),
      remove: remove.withOptimisticUpdate((store, { counterId }) => edit(store, counterId, () => null)),
    };
  }, [counters, add, bump, update, remove, projectId]);
}
