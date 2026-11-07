import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Place } from "./navigation";

/** A project and a way to move its place; moves show at once (optimistic) and save in the background. */
export function useProject(projectId: Id<"projects">) {
  const project = useQuery(api.projects.get, { projectId });
  const moveTo = useMutation(api.projects.moveTo);
  const optimisticMoveTo = useMemo(
    () =>
      moveTo.withOptimisticUpdate((store, { projectId, position, repeats }) => {
        const current = store.getQuery(api.projects.get, { projectId });
        if (current) store.setQuery(api.projects.get, { projectId }, { ...current, position, ...(repeats && { repeats }) });
      }),
    [moveTo],
  );
  const move = useCallback(({ position, repeats }: Place) => void optimisticMoveTo({ projectId, position, repeats }), [optimisticMoveTo, projectId]);
  return { project, move };
}
