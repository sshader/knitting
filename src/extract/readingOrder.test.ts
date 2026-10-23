import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { RAW, readPage } from "./patterns";
import { inReadingOrder } from "./readingOrder";

// Runs against locally preprocessed sample patterns (data/raw is gitignored).
const text = (doc: string, n: number) => {
  return inReadingOrder(readPage(doc, n))
    .words.map((w) => w.t)
    .join(" ");
};
/** Each needle appears, in this order. */
const inOrder = (hay: string, needles: string[]) => {
  const at = needles.map((n) => hay.indexOf(n));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect(at).toEqual([...at].sort((a, b) => a - b));
};

describe.skipIf(!fs.existsSync(RAW))("reading order on sample pages", () => {
  test("Moonbun p6: heading, intro, then size columns left before right", () => {
    inOrder(text("moonbun-jumper-by-saskieco", 6), ["S E T", "Before starting chart a", "SIZE 1", "SIZE 2", "SIZE 6", "SIZE 7", "SIZE 10", "All sizes: Knit chart."]);
  });
  test("Moonbun p9: side-by-side sleeve options, then cuff below both", () => {
    inOrder(text("moonbun-jumper-by-saskieco", 9), ["SHORTER SLEEVE", "every 10 (14, 10, 8)", "LONGER SLEEVE", "every 11 (14, 10, 8)", "C U F F", "ribbed cuff", "F I N I S H I N G"]);
  });
  test("dot-top p3: columns read top to bottom", () => {
    inOrder(text("dot-top-eng", 3), ["Overview", "Yarn requirements", "Gauge", "Knitting notes", "This pattern uses shadow knitting", "Abbreviations", "Shadow knitting dot chart"]);
  });
  test("Moonbun p5: letter-spaced headings stay whole and in place", () => {
    inOrder(text("moonbun-jumper-by-saskieco", 5), ["B E G I N P A T T E R N", "Using 3.5mm", "N E C K R O W S H A P I N G", "K 1 round", "SR1 (rs)"]);
  });
  test("Wilde p6: left column's two sections before the right column", () => {
    inOrder(text("wilde-cardigan-pattern-v4", 6), ["YOKE SETUP", "P1 (left front)", "NECK SHAPING", "147 sts total", "MAIN YOKE", "Sizes 1 & 2"]);
  });
  test("Wilde p11: bullets don't make a column; left column finishes first", () => {
    inOrder(text("wilde-cardigan-pattern-v4", 11), ["Row 23", "Rows 24 & 25", "SLEEVE", "Work 13", "Decrease rules", "Repeat from", "FIT CHECK"]);
  });
  test("Wilde p2: the size table reads row by row", () => {
    inOrder(text("wilde-cardigan-pattern-v4", 2), ["SIZING", "Size 1 2 3 4 5 6 7 8 9", "To fit bust"]);
  });
  test("single-column pages keep their order", () => {
    inOrder(text("nb-tove-eng4", 4), ["NECKLINE", "Cast on 108", "YOKE", "Short row 1", "Last short row"]);
  });
});
