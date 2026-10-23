import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { MapFixture, SectionsFixture } from "../../../extract/mapFixture";
import type { TriagePageExpectation } from "../../../extract/triageFixture";

/**
 * Reviews save on every click and keystroke. Each save updates the cached
 * query right away (an optimistic update) so typing in a note doesn't wait
 * on the server.
 */

export function useMapReview(pattern: string | null): [MapFixture, (change: (r: MapFixture) => MapFixture) => void] {
  const p = useQuery(api.patterns.get, pattern ? { pattern } : "skip");
  const save = useMutation(api.patterns.setMapReview).withOptimisticUpdate((store, { pattern, review }) => {
    const current = store.getQuery(api.patterns.get, { pattern });
    if (current) store.setQuery(api.patterns.get, { pattern }, { ...current, mapReview: review });
  });
  const review = p?.mapReview ?? {};
  return [
    review,
    (change) => {
      if (pattern) void save({ pattern, review: change(review) });
    },
  ];
}

export function useSectionsReview(pattern: string | null): [SectionsFixture, (key: string, v: SectionsFixture[string] | undefined) => void] {
  const p = useQuery(api.patterns.get, pattern ? { pattern } : "skip");
  const save = useMutation(api.patterns.setSectionsReview).withOptimisticUpdate((store, { pattern, review }) => {
    const current = store.getQuery(api.patterns.get, { pattern });
    if (current) store.setQuery(api.patterns.get, { pattern }, { ...current, sectionsReview: review });
  });
  const review = p?.sectionsReview ?? {};
  return [
    review,
    (key, v) => {
      if (!pattern) return;
      const { [key]: _old, ...rest } = review;
      void save({ pattern, review: v ? { ...rest, [key]: v } : rest });
    },
  ];
}

/** Saves one page's triage review (null clears it). */
export function useSetTriageReview(pattern: string) {
  const save = useMutation(api.pages.setTriageReview).withOptimisticUpdate((store, { pageId, review }) => {
    const pages = store.getQuery(api.pages.forPattern, { pattern });
    if (pages) store.setQuery(api.pages.forPattern, { pattern }, pages.map((p) => (p._id === pageId ? { ...p, triageReview: review ?? undefined } : p)));
  });
  return (pageId: Id<"pages">, review: TriagePageExpectation | null) => void save({ pageId, review });
}
