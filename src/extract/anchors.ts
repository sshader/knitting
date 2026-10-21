import type { BBox, PageData } from "./pageData";

/**
 * Locating quoted text in a page's words (from the PDF text layer), so LLM
 * output can point at exact places: section starts now, row sources later.
 */

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, "");

/**
 * Index of the first word of `quote` on the page, matching normalized words in
 * order; -1 if absent. Short quotes like "Body" can also occur mid-sentence, so
 * a match starting a line (where headings sit) wins over an earlier one.
 */
export function findQuote(p: PageData, quote: string): number {
  const all = matches(p, quote);
  const lineStart = (i: number) => i === 0 || p.words[i - 1].blk !== p.words[i].blk || p.words[i - 1].ln !== p.words[i].ln;
  return all.find(lineStart) ?? all[0] ?? -1;
}

function matches(p: PageData, quote: string): number[] {
  const q = quote.split(/\s+/).map(norm).filter(Boolean);
  if (q.length === 0) return [];
  const w = p.words.map((x) => norm(x.t));
  const found: number[] = [];
  outer: for (let i = 0; i < w.length; i++) {
    let j = i;
    for (const tok of q) {
      while (j < w.length && w[j] === "") j++;
      // Hyphenation and run-together words: accept a prefix match on the last token.
      if (j >= w.length || !(w[j] === tok || (tok === q.at(-1) && w[j].startsWith(tok)) || w[j].replace(/-/g, "") === tok)) continue outer;
      j++;
    }
    found.push(i);
  }
  return found;
}

export interface Pos {
  page: number;
  word: number;
}

/**
 * Line boxes covering words from `start` (inclusive) to `end` (exclusive),
 * across pages, in reading order. `pages` maps page number to page data.
 */
export function rangeBoxes(pages: Map<number, PageData>, start: Pos, end: Pos | null): { page: number; boxes: BBox[] }[] {
  const out: { page: number; boxes: BBox[] }[] = [];
  const nums = [...pages.keys()].sort((a, b) => a - b).filter((n) => n >= start.page && (!end || n <= end.page));
  for (const n of nums) {
    const words = pages.get(n)!.words;
    const from = n === start.page ? start.word : 0;
    const to = end && n === end.page ? end.word : words.length;
    const lines = new Map<string, BBox>();
    for (const w of words.slice(from, to)) {
      const k = `${w.blk}:${w.ln}`;
      const b = lines.get(k);
      lines.set(k, b ? [Math.min(b[0], w.b[0]), Math.min(b[1], w.b[1]), Math.max(b[2], w.b[2]), Math.max(b[3], w.b[3])] : [...w.b]);
    }
    if (lines.size) out.push({ page: n, boxes: [...lines.values()] });
  }
  return out;
}
