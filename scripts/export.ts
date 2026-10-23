/**
 * Pull what the tests need from Convex into local files:
 * - reviews -> fixtures/triage/<doc>.json, fixtures/map/<pattern>.json, fixtures/sections/<pattern>.json
 * - each pattern's map, sections, and charts -> data/snapshot/<pattern>.json
 *
 *   npx tsx scripts/export.ts [pattern...]   (default: all)
 */
import fs from "node:fs";
import path from "node:path";
import { api } from "../convex/_generated/api";
import type { Snapshot } from "../src/extract/snapshot";
import { connect } from "./convex";

const write = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
};

const convex = await connect();
const named = process.argv.slice(2);
const patterns = (await convex.query(api.patterns.list, {})).map((p) => p.slug).filter((p) => !named.length || named.includes(p));

for (const pattern of patterns) {
  const p = (await convex.query(api.patterns.get, { pattern }))!;
  const pages = await convex.query(api.pages.forPattern, { pattern });
  for (const { doc } of p.docs) {
    const reviews = Object.fromEntries(pages.filter((pg) => pg.doc === doc && pg.triageReview).map((pg) => [pg.docPage, pg.triageReview]));
    if (Object.keys(reviews).length) write(`fixtures/triage/${doc}.json`, reviews);
  }
  if (p.mapReview) write(`fixtures/map/${pattern}.json`, p.mapReview);
  if (p.sectionsReview) write(`fixtures/sections/${pattern}.json`, p.sectionsReview);

  const map = await convex.query(api.maps.get, { pattern, mode: "text" });
  if (!map) continue;
  const sections = await convex.query(api.sections.forPattern, { pattern });
  const charts = await convex.query(api.charts.forPattern, { pattern });
  const snapshot: Snapshot = {
    map: map.map,
    extractions: Object.fromEntries(sections.flatMap((s) => (s.extraction ? [[s.sectionId, s.extraction]] : []))),
    charts: charts.map((c) => c.chart),
  };
  write(`data/snapshot/${pattern}.json`, snapshot);
  console.log(`${pattern}: ${sections.length} sections, ${charts.length} charts`);
}
