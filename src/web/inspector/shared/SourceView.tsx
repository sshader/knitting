import { findQuoteSpan } from "../../../extract/anchors";
import type { BBox } from "../../../extract/pageData";
import { inReadingOrder } from "../../../extract/readingOrder";
import { boxStyle } from "./box";
import type { PageRow } from "./types";
import { usePageData } from "./usePageData";

/** Source pages with each quote highlighted where it's found in the page's words. */
export function SourceView({ sources, pages }: { sources: { page: number; quote: string }[]; pages: PageRow[] }) {
  const data = usePageData(
    pages,
    sources.map((s) => s.page),
  );

  const byPage = new Map<number, { quote: string; boxes: BBox[] | null }[]>();
  for (const s of sources) {
    const d = data.get(s.page);
    const span = d && findQuoteSpan(d, s.quote);
    const boxes = d && span ? inReadingOrder(d).words.slice(span.start, span.end + 1).map((w) => w.b) : null;
    byPage.set(s.page, [...(byPage.get(s.page) ?? []), { quote: s.quote, boxes }]);
  }

  return (
    <>
      {[...byPage].map(([page, quotes]) => {
        const p = pages.find((x) => x.page === page);
        if (!p) return <p key={page}>page {page} not found</p>;
        return (
          <figure key={page} className="reader-page">
            <figcaption>
              <b>p{page}</b>{" "}
              {quotes.map((q) => (
                <span key={q.quote} className={q.boxes || !data.has(page) ? "muted" : "bad"}>
                  “{q.quote}”{q.boxes || !data.has(page) ? "" : " (not found)"}{" "}
                </span>
              ))}
            </figcaption>
            <div className="page">
              <img src={p.pngUrl} alt={`page ${page}`} />
              {quotes.flatMap((q, qi) => (q.boxes ?? []).map((b, i) => <div key={`${qi}-${i}`} className="box text-hl" style={boxStyle(b)} />))}
            </div>
          </figure>
        );
      })}
    </>
  );
}
