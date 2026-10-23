import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { chartReport } from "./chartReport";
import type { Snapshot } from "./snapshot";

// Lucky Stars writes every chart round out; decrease rounds as the stitches they leave.
const file = "data/snapshot/lucky-stars-beanie-v5.json";

describe.skipIf(!fs.existsSync(file))("chart rows vs the pattern's written rows", () => {
  const { charts }: Snapshot = JSON.parse(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}");
  test("decrease rounds compare as worked", () => {
    const written = Object.fromEntries(charts.map((c) => [c.id, chartReport(c).written]));
    expect(written["chart-size1"]).toEqual({ rows: 70, identical: 66, stitchesDiffering: 18 });
    expect(written["chart-size2"]).toEqual({ rows: 73, identical: 73, stitchesDiffering: 0 });
  });
});
