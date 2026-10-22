import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { expandPattern } from "./expand";
import type { Chart, Section } from "./schema";
import type { StepsFixture } from "./steps";

/**
 * The expander must reproduce the hand-written steps in fixtures/steps from the
 * extracted sections and charts (data/ is local, so this skips without it).
 */
const load = (pattern: string) => {
  const { map } = JSON.parse(fs.readFileSync(`data/map/text/${pattern}.json`, "utf8"));
  const sections: Section[] = map.sections.map((s: { id: string }) => JSON.parse(fs.readFileSync(`data/sections/${pattern}/${s.id}.json`, "utf8")).tree);
  const charts: Record<string, Chart> = {};
  for (const f of fs.readdirSync(`data/charts/${pattern}`).filter((f) => f.endsWith(".json"))) {
    const c = JSON.parse(fs.readFileSync(`data/charts/${pattern}/${f}`, "utf8")).chart;
    charts[c.id] = c;
  }
  return { map, sections, charts };
};

for (const file of fs.existsSync("fixtures/steps") ? fs.readdirSync("fixtures/steps") : []) {
  const fx: StepsFixture = JSON.parse(fs.readFileSync(`fixtures/steps/${file}`, "utf8"));
  describe.skipIf(!fs.existsSync(`data/charts/${fx.pattern}`))(`expand ${fx.pattern}`, () => {
    const { map, sections, charts } = load(fx.pattern);
    const choices = map.options.map((o: { choices: string[] }) => o.choices[0]);
    const steps = expandPattern({ sections, charts, size: fx.size, choices });
    for (const want of fx.steps) {
      test(want.label, () => {
        const got = steps.find((s) => s.node === want.node && s.chart?.row === want.chart?.row);
        expect(got, `no step for node ${want.node} row ${want.chart?.row}`).toBeDefined();
        expect({ label: got!.label, of: got!.of, instruction: got!.instruction, chart: got!.chart, stitches: got!.stitches }).toEqual({
          label: want.label,
          of: want.of,
          instruction: want.instruction,
          chart: want.chart,
          stitches: want.stitches,
        });
      });
    }
  });
}
