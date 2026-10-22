import type { BBox, PageData } from "./pageData";
import { inReadingOrder } from "./readingOrder";

/**
 * Locating quoted text in a page's words (from the PDF text layer), so LLM
 * output can point at exact places: section starts now, row sources later.
 * Word indices are in reading order (see readingOrder.ts).
 */

/**
 * Letter/digit tokens of a string, lowercased. PDF "words" can glue several
 * tokens together ("1.\u200bBegin" is a list number and a word), so matching
 * works on tokens, not words.
 */
const tokens = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u00ad\u200b]/g, "") // soft hyphen, zero-width space
    .match(/[\p{L}\p{N}]+/gu) ?? [];

/** Page tokens in reading order, each with the index of the word it came from. */
function pageTokens(p: PageData) {
  return p.words.flatMap((w, word) => tokens(w.t).map((t) => ({ t, word })));
}

/**
 * Index of the first word of `quote` on the page, matching normalized words in
 * order; -1 if absent. Short quotes like "Body" can also occur mid-sentence, so
 * a match starting a line (where headings sit) wins over an earlier one.
 */
export function findQuote(page: PageData, quote: string, after = -1): number {
  return findQuoteSpan(page, quote, after)?.start ?? -1;
}

/** Like `findQuote`, with the quote's last word too (inclusive), for highlighting it. */
export function findQuoteSpan(page: PageData, quote: string, after = -1): { start: number; end: number } | null {
  const p = inReadingOrder(page);
  const all = matches(p, quote).filter((m) => m.start > after);
  const lineStart = ({ start: i }: { start: number }) =>
    i === 0 || p.words[i - 1].blk !== p.words[i].blk || p.words[i - 1].ln !== p.words[i].ln;
  return all.find(lineStart) ?? all[0] ?? null;
}

/**
 * Start positions of consecutive sections, each searched for after the
 * previous one, so repeated openings ("Rnd 1: k all sts to end of rnd." for
 * two sleeve options) resolve in order. Null where a quote isn't found.
 */
export function locateSections(
  sections: { startPage: number; startQuote: string }[],
  page: (n: number) => PageData | undefined,
): (Pos | null)[] {
  let prev: Pos | null = null;
  return sections.map((s) => {
    const p = page(s.startPage);
    const after = prev && prev.page === s.startPage ? prev.word : -1;
    const word = p ? findQuote(p, s.startQuote, after) : -1;
    const pos = word >= 0 ? { page: s.startPage, word } : null;
    if (pos) prev = pos;
    return pos;
  });
}

/** Word spans where `quote`'s tokens occur consecutively. A token split by line-end hyphenation ("ed-" + "ges") also matches. */
function matches(p: PageData, quote: string): { start: number; end: number }[] {
  const q = tokens(quote);
  if (q.length === 0) return [];
  const w = pageTokens(p);
  const found = new Map<number, number>();
  outer: for (let i = 0; i < w.length; i++) {
    let j = i;
    for (const tok of q) {
      if (j < w.length && w[j].t === tok) j++;
      else if (j + 1 < w.length && w[j].t + w[j + 1].t === tok) j += 2;
      else continue outer;
    }
    if (!found.has(w[i].word)) found.set(w[i].word, w[j - 1].word);
  }
  return [...found].map(([start, end]) => ({ start, end }));
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
    const words = inReadingOrder(pages.get(n)!).words;
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
