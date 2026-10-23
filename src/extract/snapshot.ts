import type { Chart, Section } from "../shared/schema";
import type { DocMap } from "./docMap";
import { toSection, type SectionExtraction } from "./sectionSchema";

/** A pattern's extracted map, sections, and charts, as scripts/export.ts writes them to data/snapshot/<pattern>.json. */
export interface Snapshot {
  map: DocMap;
  extractions: Record<string, SectionExtraction>;
  charts: Chart[];
}

/**
 * The section trees a knitter works through, in the map's order. Built from
 * the flat stage 2 extractions on read, so a change to toSection applies
 * without re-saving anything. Sections not extracted (or not valid) are left out.
 */
export function sectionTrees(map: DocMap, extractions: Record<string, SectionExtraction | undefined>): Section[] {
  return map.sections.flatMap((s) => {
    const x = extractions[s.id];
    if (!x) return [];
    try {
      return [toSection(x, s)];
    } catch {
      return [];
    }
  });
}
