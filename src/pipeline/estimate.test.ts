import { expect, test } from "vitest";
import type { DocMap } from "../extract/docMap";
import { estimateRest } from "./estimate";

const section = (id: string): DocMap["sections"][number] => ({
  id,
  title: id,
  startPage: 1,
  startQuote: "",
  pages: [1],
  choices: [],
  repeat: "",
  chartIds: [],
  summary: "",
});

const map = (sections: DocMap["sections"]): DocMap => ({
  title: "",
  designer: "",
  sizes: ["1"],
  sizeNotation: "",
  options: [],
  construction: "",
  pages: [],
  sections,
  charts: [],
  techniques: [],
  reviewNotes: [],
});

test("each section reads the cached pattern and writes rows; the first writes the cache", () => {
  // Dot Top's map read 36k tokens; its section calls shared a ~49k token prefix.
  const sections = Array.from({ length: 14 }, (_, i) => section(`s${i}`));
  const m = map(sections);
  const usage = { inputTokens: 49_000 - Math.round(JSON.stringify(m).length / 3), outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const estimate = estimateRest(m, usage, sections);
  // 14 x (49k x $0.20 + 4k x $10) / M + 49k x $2.50 / M + glossary
  expect(estimate).toBeGreaterThan(800_000);
  expect(estimate).toBeLessThan(900_000);
});
