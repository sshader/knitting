import { findQuoteSpan } from "../../../extract/anchors";
import type { BBox } from "../../../extract/pageData";
import { inReadingOrder } from "../../../extract/readingOrder";
import type { PageRow } from "./types";
import { usePageData } from "./usePageData";

export interface QuoteBoxes {
  page: number;
  quote: string;
  /** Word boxes of the quote; null while the page loads or if the quote isn't on it. */
  boxes: BBox[] | null;
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
    const boxes = d && span ? inReadingOrder(d).words.slice(span.start, span.end + 1).map((w) => w.b) : null;
    return { ...s, boxes, loaded: !!d };
  });
}
