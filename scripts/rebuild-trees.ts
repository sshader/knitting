/**
 * Rebuild the core section trees in data/sections from the saved extractions
 * (after a change to the core schema or toSection), without calling the model.
 *
 *   npx tsx scripts/rebuild-trees.ts
 */
import fs from "node:fs";
import { toSection } from "../src/extract/sectionSchema";

for (const pattern of fs.readdirSync("data/sections")) {
  const { map } = JSON.parse(fs.readFileSync(`data/map/text/${pattern}.json`, "utf8"));
  for (const f of fs.readdirSync(`data/sections/${pattern}`)) {
    const file = `data/sections/${pattern}/${f}`;
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!j.extraction) continue;
    j.tree = toSection(j.extraction, map.sections.find((s: { id: string }) => s.id === j.section));
    delete j.error;
    fs.writeFileSync(file, JSON.stringify(j, null, 1));
  }
  console.log(`${pattern}: rebuilt`);
}
