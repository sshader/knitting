import { describe, expect, test } from "vitest";
import { findQuote, rangeBoxes } from "./anchors";
import type { PageData } from "./pageData";

const page = (n: number, text: string): PageData => ({
  page: n,
  width: 600,
  height: 800,
  spans: [],
  drawings: [],
  images: [],
  words: text.split(" ").map((t, i) => ({ t, b: [i / 100, n / 10, (i + 1) / 100, n / 10 + 0.01], blk: 0, ln: Math.floor(i / 5) })),
});

describe("findQuote", () => {
  const p = page(1, "Pattern NECKLINE Cast on 108 (112) 116 (120) stitches. YOKE Attach colour B");
  test("matches case- and punctuation-insensitively", () => {
    expect(findQuote(p, "neckline cast on")).toBe(1);
    expect(findQuote(p, "YOKE Attach colour B")).toBe(9);
    expect(findQuote(p, "108 (112) 116")).toBe(4);
  });
  test("prefers a match at the start of a line", () => {
    // Lines are 5 words: "the body is knit" mid-line, then "Body" starting line 2 (word 5).
    const q = page(1, "the body is knit flat Body work in rounds");
    expect(findQuote(q, "Body")).toBe(5);
  });
  test("returns -1 when absent", () => {
    expect(findQuote(p, "SLEEVES")).toBe(-1);
  });
});

describe("rangeBoxes", () => {
  test("spans pages and stops at the end position", () => {
    const pages = new Map([1, 2, 3].map((n) => [n, page(n, "a b c d e f g h i j")] as const));
    const r = rangeBoxes(pages, { page: 1, word: 5 }, { page: 2, word: 5 });
    expect(r.map((x) => [x.page, x.boxes.length])).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });
});
