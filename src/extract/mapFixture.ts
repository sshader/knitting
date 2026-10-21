import type { DocMap, PageRole } from "./docMap";

/**
 * Hand review of a stage 1 map, saved by the inspector to
 * fixtures/map/<pattern>.json. Page roles are recorded as the correct set
 * (confirmed or corrected); sections, charts, and metadata get a verdict.
 */
export interface Verdict {
  ok: boolean;
  note?: string;
}

export interface MapFixture {
  pages?: Record<string, { roles: PageRole[] }>;
  sections?: Record<string, Verdict>;
  charts?: Record<string, Verdict>;
  /** Title, sizes, options, construction. */
  meta?: Verdict;
  note?: string;
}

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
