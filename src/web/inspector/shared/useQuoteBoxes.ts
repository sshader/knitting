import { findQuoteSpan } from "../../../extract/anchors";
import { union, type BBox } from "../../../extract/pageData";
import { inReadingOrder } from "../../../extract/readingOrder";
import type { PageRow } from "./types";
import { usePageData } from "./usePageData";

export interface QuoteBoxes {
  page: number;
  quote: string;
  /** Word boxes of the quote; null while the page loads or if the quote isn't on it. */
  boxes: BBox[] | null;
  /** One box around the whole lines the quote is on (within its column). */
  lines: BBox | null;
  loaded: boolean;
}

/** Where each source quote sits on its page, from the page's words. */
export function useQuoteBoxes(pages: PageRow[], sources: { page: number; quote: string }[]): QuoteBoxes[] {
  const data = usePageData(
    pages,
    sources.map((s) => s.page),
  );
  return sources.map((s) => {
    const d = data.get(s.page);
    const span = d && findQuoteSpan(d, s.quote);
    if (!d || !span) return { ...s, boxes: null, lines: null, loaded: !!d };
    const words = inReadingOrder(d).words;
    const quoted = words.slice(span.start, span.end + 1);
    const lineKeys = new Set(quoted.map((w) => `${w.blk}:${w.ln}`));
    const lines = union(words.filter((w) => lineKeys.has(`${w.blk}:${w.ln}`)).map((w) => w.b));
    return { ...s, boxes: quoted.map((w) => w.b), lines, loaded: true };
  });
}
