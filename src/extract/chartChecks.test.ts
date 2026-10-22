import { describe, expect, test } from "vitest";
import type { Chart } from "../shared/schema";
import { checkStitchCounts } from "./chartChecks";
import type { FlatNode } from "./sectionSchema";

// 4-wide repeat: 2 live sts on row 1, an increase on row 2 makes 3, then 4.
const chart: Chart = {
  id: "a",
  title: "A",
  width: 4,
  cells: ["xx..", "xM..", "M..."],
  legend: { ".": { label: "k", rs: "k" }, M: { label: "m1", rs: "m1" }, x: { label: "no stitch", noStitch: true } },
  readDirection: "rtl",
};

const node = (id: string, toRow: number, stitchCount: number[]): FlatNode => ({
  id,
  kind: "chart",
  parentId: "",
  sizes: [],
  choices: [],
  source: [],
  title: "",
  label: "",
  side: "none",
  text: "",
  rows: [],
  stitchCount,
  chartRefs: [{ ids: ["a"] }],
  fromRow: [1],
  toRow: [toRow],
  times: [],
  until: "",
  overlays: [],
});

describe("checkStitchCounts", () => {
  test("consistent repeat counts pass", () => {
    const r = checkStitchCounts(chart, [node("n1", 2, [30, 60]), node("n2", 3, [40, 80])], ["S", "L"]);
    expect(r.problems).toEqual([]);
    expect(r.checkpoints.map((c) => c.repeats)).toEqual([10, 20, 10, 20]);
  });

  test("a chart misread by a stitch is caught", () => {
    // Stated counts imply 10 repeats of 3 sts, then 12 of 4: inconsistent.
    const r = checkStitchCounts(chart, [node("n1", 2, [30]), node("n2", 3, [48])], ["S"]);
    expect(r.problems).toEqual(["size S: stitch counts imply different repeat counts (10, 12)"]);
  });
});
