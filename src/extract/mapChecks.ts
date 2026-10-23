import { locateSections } from "./anchors";
import type { DocMap } from "./docMap";
import { docsFor, pageLoader, triageDoc, type PageRef } from "./patterns";
import { regionIds } from "./triage";

/** Problems with a stage 1 map that code can find: unknown pages, charts, regions, choices, and start quotes that aren't on their page. */
export function checkMap(map: DocMap, pages: PageRef[], pattern: string): string[] {
  const problems: string[] = [];
  const pageNums = new Set(pages.map((p) => p.page));
  const regions = new Set<string>();
  for (const d of docsFor(pattern)) {
    for (const t of triageDoc(d.doc)) {
      const ids = regionIds({ ...t, page: d.firstPage + t.page - 1 });
      [...ids.charts, ...ids.images].forEach((r) => regions.add(r.id));
    }
  }
  const mapped = new Set(map.pages.map((p) => p.page));
  for (const p of pageNums) if (!mapped.has(p)) problems.push(`page ${p} has no roles`);
  for (const s of map.sections) for (const p of s.pages) if (!pageNums.has(p)) problems.push(`section ${s.id}: no page ${p}`);
  const chartIds = new Set(map.charts.map((c) => c.id));
  for (const s of map.sections) for (const c of s.chartIds) if (!chartIds.has(c)) problems.push(`section ${s.id}: unknown chart ${c}`);
  for (const c of map.charts) {
    for (const r of [...c.regionIds, ...c.legendRegionIds]) if (!regions.has(r) && !/^p\d+$/.test(r)) problems.push(`chart ${c.id}: unknown region ${r}`);
    for (const i of c.sizes) if (i < 0 || i >= map.sizes.length) problems.push(`chart ${c.id}: size index ${i} out of range`);
  }
  locateSections(map.sections, pageLoader(pages)).forEach((pos, i) => {
    const s = map.sections[i];
    if (!pos) problems.push(`section ${s.id}: start quote not found on p${s.startPage} (after the previous section): "${s.startQuote}"`);
  });
  for (const s of map.sections)
    for (const ch of s.choices) if (!map.options.some((o) => o.choices.includes(ch))) problems.push(`section ${s.id}: unknown choice ${ch}`);
  return problems;
}
