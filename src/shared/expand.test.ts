import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { sectionTrees, type Snapshot } from "../extract/snapshot";
import { expandPattern } from "./expand";
import type { StepsFixture } from "./steps";

/**
 * The expander must reproduce the hand-written steps in fixtures/steps from the
 * extracted sections and charts. Those live in Convex; `npx tsx scripts/export.ts`
 * pulls them to data/snapshot (local, so this skips without it).
 */
const snapshotFile = (pattern: string) => `data/snapshot/${pattern}.json`;

for (const file of fs.existsSync("fixtures/steps") ? fs.readdirSync("fixtures/steps") : []) {
  const fx: StepsFixture = JSON.parse(fs.readFileSync(`fixtures/steps/${file}`, "utf8"));
  describe.skipIf(!fs.existsSync(snapshotFile(fx.pattern)))(`expand ${fx.pattern}`, () => {
    const { map, extractions, charts }: Snapshot = JSON.parse(fs.readFileSync(snapshotFile(fx.pattern), "utf8"));
    const steps = expandPattern({
      sections: sectionTrees(map, extractions),
      charts: Object.fromEntries(charts.map((c) => [c.id, c])),
      size: fx.size,
      choices: map.options.map((o) => o.choices[0]),
    });
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
