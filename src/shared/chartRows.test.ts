import { describe, expect, test } from "vitest";
import { expand, generateRow, parseRuns } from "./chartRows";
import type { Chart } from "./schema";

const legend = {
  ".": { label: "knit MC", rs: "k", ws: "p", color: "MC" },
  x: { label: "knit CC", rs: "k", ws: "p", color: "CC" },
  M: { label: "m1 CC", rs: "m1", color: "CC" },
  "#": { label: "no stitch", noStitch: true },
};

const chart = (cells: string[], over: Partial<Chart> = {}): Chart => ({
  id: "t",
  title: "test",
  width: cells[0].length,
  cells,
  legend,
  readDirection: "rtl",
  ...over,
});

describe("generateRow", () => {
  test("in the round: right to left, grouped runs", () => {
    // Drawn left to right; worked right to left.
    expect(generateRow(chart(["xx...x"]), 1).text).toBe("k1 CC, k3 MC, k2 CC");
  });

  test("no-stitch cells are skipped; other stitches repeat with ×", () => {
    expect(generateRow(chart(["#MM..#"]), 1).text).toBe("k2 MC, m1 CC ×2");
  });

  test("flat: WS rows run left to right with WS meanings", () => {
    const c = chart(["..xxx", "..xxx"], { readDirection: "alternate" });
    expect(generateRow(c, 1)).toMatchObject({ side: "RS", text: "k3 CC, k2 MC" });
    expect(generateRow(c, 2)).toMatchObject({ side: "WS", text: "p2 MC, p3 CC" });
  });

  test("a full-width repeat wraps the row", () => {
    expect(generateRow(chart(["x..x"], { repeat: { fromCol: 1, toCol: 4 } }), 1).text).toBe("*k1 CC, k2 MC, k1 CC*, repeat to end");
  });

  test("a partial repeat keeps edge stitches outside", () => {
    // Columns from the right: 1=".", 2-3="xx" (repeat), 4="."
    expect(generateRow(chart([".xx."], { repeat: { fromCol: 2, toCol: 3 } }), 1).text).toBe("k1 MC, *k2 CC*, repeat to last 1 st, k1 MC");
  });

  test("firstRow offsets row numbers", () => {
    expect(generateRow(chart(["xx", ".."], { firstRow: 49 }), 50).text).toBe("k2 MC");
  });
});

describe("parseRuns", () => {
  test("reads the pattern's own notation, including bare k for k1", () => {
    expect(expand(parseRuns("k9 A, k A, k2 B"))).toEqual([...Array(10).fill("k A"), "k B", "k B"]);
    expect(parseRuns("k18 k4, k30").map((r) => r.n)).toEqual([18, 4, 30]);
  });
});

describe("shaping read off the row below", () => {
  const shaped = (cells: string[]) => chart(cells, { legend: { ...legend, "#": { label: "no stitch", noStitch: true } } });

  test("cells that turn no-stitch are consumed by the live stitch before them", () => {
    // Drawn ".##...", worked right to left: . . . # # . -> k2, CDD (3 to 1), k1.
    const c = shaped(["......", ".##..."]);
    expect(generateRow(c, 2)).toMatchObject({ text: "k2 MC, CDD MC, k1 MC", consumed: 6, produced: 4 });
  });

  test("in the round, leading consumed cells close the last decrease", () => {
    // Drawn ".....#": the # is the rightmost cell, so first in working order;
    // it wraps to the round's last stitch.
    const c = shaped(["......", ".....#"]);
    expect(generateRow(c, 2).text).toBe("k4 MC, k2tog MC (with the round's first st)");
  });

  test("cells that turn live are increases that consume nothing", () => {
    const c = shaped(["#..#", "M..M"]);
    expect(generateRow(c, 2)).toMatchObject({ text: "m1 CC, k2 MC, m1 CC", consumed: 2, produced: 4 });
  });

  test("a known repeat count replaces 'repeat to end'", () => {
    expect(generateRow(chart(["x..x"], { repeat: { fromCol: 1, toCol: 4 } }), 1, { repeats: 12 }).text).toBe("*k1 CC, k2 MC, k1 CC*, repeat 12 times");
  });
});

test("consumed cells after older no-stitch cells go into the following stitch", () => {
  const c = chart(["..#.", ".##."], { legend: { ...legend, "#": { label: "no stitch", noStitch: true } } });
  // Worked right to left. Row 1: k, #, k, k (3 live). Row 2: k, #(old), #(new), k.
  // The new one follows an old no-stitch cell, so the next stitch takes it: k1, k2tog.
  expect(generateRow(c, 2)).toMatchObject({ text: "k1 MC, k2tog MC", consumed: 3, produced: 2 });
});
