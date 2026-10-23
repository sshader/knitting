import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { sectionTrees } from "../../extract/snapshot";
import { expandPattern } from "../../shared/expand";
import type { ChartRow } from "../inspector/shared/types";

/** Everything the knit view shows for a project: the map, its pages and charts, and the steps for its size and options. */
export function useKnitData(project: (Doc<"projects"> & { pattern: string }) | null | undefined) {
  const args = project ? { pattern: project.pattern } : "skip";
  const saved = useQuery(api.maps.get, project ? { pattern: project.pattern, mode: "text" } : "skip");
  const sections = useQuery(api.sections.forPattern, args);
  const charts = useQuery(api.charts.forPattern, args);
  const pages = useQuery(api.pages.forPattern, args);
  const glossary = useQuery(api.glossaries.get, args);

  // Moving through the pattern updates the project (a new object each time);
  // key on its setup so the steps are only re-expanded when that changes.
  const size = project?.size ?? 0;
  const choicesKey = JSON.stringify(project?.choices ?? []);
  const choices: string[] = useMemo(() => JSON.parse(choicesKey), [choicesKey]);

  return useMemo(() => {
    if (!saved || !sections || !charts || !pages || glossary === undefined) return null;
    const extractions = Object.fromEntries(sections.map((s) => [s.sectionId, s.extraction]));
    const byId: Record<string, ChartRow> = Object.fromEntries(charts.map((c) => [c.chartId, c]));
    const steps = expandPattern({
      sections: sectionTrees(saved.map, extractions),
      charts: Object.fromEntries(charts.map((c) => [c.chartId, c.chart])),
      size,
      choices,
    });
    return { map: saved.map, steps, charts: byId, pages, glossary: glossary?.glossary ?? null };
  }, [saved, sections, charts, pages, glossary, size, choices]);
}

export type KnitData = NonNullable<ReturnType<typeof useKnitData>>;
