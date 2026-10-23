import { z } from "zod";
import { PAGE_ROLES, type DocMap } from "./docMap";

/**
 * Hand review of a stage 1 map, one per pattern. Page roles are recorded as
 * the correct set (confirmed or corrected); sections, charts, and metadata
 * get a verdict.
 */
export const Verdict = z.object({ ok: z.boolean(), note: z.string().optional() });
export type Verdict = z.infer<typeof Verdict>;

export const MapFixture = z.object({
  /** By page number. */
  pages: z.record(z.string(), z.object({ roles: z.array(z.enum(PAGE_ROLES)) })).optional(),
  sections: z.record(z.string(), Verdict).optional(),
  charts: z.record(z.string(), Verdict).optional(),
  /** Title, sizes, options, construction. */
  meta: Verdict.optional(),
  note: z.string().optional(),
});
export type MapFixture = z.infer<typeof MapFixture>;

/** Stage 2 reviews: per node id, plus "section:<id>" for whole-section verdicts. */
export const SectionsFixture = z.record(z.string(), Verdict);
export type SectionsFixture = z.infer<typeof SectionsFixture>;

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Score a map against a fixture: how many reviewed items the map gets right. */
export function scoreMap(map: DocMap, f: MapFixture) {
  const pages = Object.entries(f.pages ?? {}).map(([n, e]) => {
    const got = map.pages.find((p) => p.page === Number(n))?.roles ?? [];
    return { page: Number(n), ok: same(got, e.roles), got, expected: e.roles };
  });
  const verdicts = [...Object.values(f.sections ?? {}), ...Object.values(f.charts ?? {}), ...(f.meta ? [f.meta] : [])];
  return {
    pages: { right: pages.filter((p) => p.ok).length, total: pages.length, wrong: pages.filter((p) => !p.ok) },
    items: { right: verdicts.filter((v) => v.ok).length, total: verdicts.length },
  };
}
