/**
 * One-off: copy stage outputs and reviews saved as local files (before the
 * move to Convex) into Convex, so nothing has to be re-run.
 *
 *   npx tsx scripts/triage.ts          # first: creates the patterns and pages
 *   npx tsx scripts/import-local.ts
 *
 * Reads data/map, data/sections, data/charts and fixtures/triage.
 */
import fs from "node:fs";
import path from "node:path";
import { api } from "../convex/_generated/api";
import { DocMap } from "../src/extract/docMap";
import { patternDocs } from "../src/extract/patterns";
import { TriagePageExpectation } from "../src/extract/triageFixture";
import { connect, upload, usageOf } from "./convex";
import { MODEL } from "./llm";

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const jsonFiles = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".failed.json") && f !== "index.json") : []);

const convex = await connect();
const imported = new Set((await convex.query(api.patterns.list, {})).map((p) => p.slug));

for (const mode of ["text", "pages"] as const) {
  for (const f of jsonFiles(path.join("data/map", mode))) {
    const pattern = f.replace(/\.json$/, "");
    if (!imported.has(pattern)) continue;
    const { map, problems, usage, model } = readJson(path.join("data/map", mode, f));
    if (!DocMap.safeParse(map).success) {
      console.log(`map ${mode} ${pattern}: skipped, predates the current DocMap schema`);
      continue;
    }
    await convex.mutation(api.maps.save, { pattern, mode, map, problems, model: model ?? MODEL, usage: usageOf(usage) });
    console.log(`map ${mode} ${pattern}`);
  }
}

for (const pattern of fs.existsSync("data/sections") ? fs.readdirSync("data/sections") : []) {
  if (!imported.has(pattern)) continue;
  for (const f of jsonFiles(path.join("data/sections", pattern))) {
    const s = readJson(path.join("data/sections", pattern, f));
    await convex.mutation(api.sections.save, {
      pattern,
      sectionId: s.section,
      extraction: s.extraction,
      problems: s.problems ?? [],
      error: s.error,
      model: s.model ?? MODEL,
      seconds: s.seconds,
      usage: usageOf(s.usage),
    });
  }
  console.log(`sections ${pattern}`);
}

for (const pattern of fs.existsSync("data/charts") ? fs.readdirSync("data/charts") : []) {
  if (!imported.has(pattern)) continue;
  for (const f of jsonFiles(path.join("data/charts", pattern))) {
    const c = readJson(path.join("data/charts", pattern, f));
    const { notes, ...naming } = c.naming;
    await convex.mutation(api.charts.save, {
      pattern,
      chartId: c.chart.id,
      chart: c.chart,
      naming,
      notes,
      image: { file: await upload(convex, c.image.file, "image/png"), page: c.image.page, cropBox: c.image.cropBox },
      gridBox: c.grid.gridBox,
      unassignedCells: c.checks.unassignedCells,
      stitchCounts: c.checks.stitchCounts,
      model: MODEL,
      usage: usageOf(c.usage.naming),
    });
    console.log(`chart ${pattern} ${c.chart.id}`);
  }
}

// Triage reviews are per document page.
for (const [pattern, docs] of Object.entries(patternDocs())) {
  if (!imported.has(pattern)) continue;
  const pages = await convex.query(api.pages.forPattern, { pattern });
  for (const doc of docs) {
    const file = path.join("fixtures/triage", `${doc}.json`);
    if (!fs.existsSync(file)) continue;
    for (const [docPage, review] of Object.entries(readJson(file))) {
      const page = pages.find((p) => p.doc === doc && p.docPage === Number(docPage));
      if (page) await convex.mutation(api.pages.setTriageReview, { pageId: page._id, review: TriagePageExpectation.parse(review) });
    }
    console.log(`triage reviews ${doc}`);
  }
}
