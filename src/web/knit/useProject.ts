import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** A project and a way to move its position; moves show at once (optimistic) and save in the background. */
export function useProject(projectId: Id<"projects">) {
  const project = useQuery(api.projects.get, { projectId });
  const moveTo = useMutation(api.projects.moveTo);
  const optimisticMoveTo = useMemo(
    () =>
      moveTo.withOptimisticUpdate((store, { projectId, position }) => {
        const current = store.getQuery(api.projects.get, { projectId });
        if (current) store.setQuery(api.projects.get, { projectId }, { ...current, position });
      }),
    [moveTo],
  );
  const move = useCallback((position: { step: number; node: string }) => void optimisticMoveTo({ projectId, position }), [optimisticMoveTo, projectId]);
  return { project, move };
}
