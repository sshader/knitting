import { boxStyle } from "./box";
import type { PageRow } from "./types";
import { useQuoteBoxes, type QuoteBoxes } from "./useQuoteBoxes";

/** Source pages with each quote highlighted where it's found in the page's words. */
export function SourceView({ sources, pages }: { sources: { page: number; quote: string }[]; pages: PageRow[] }) {
  const byPage = new Map<number, QuoteBoxes[]>();
  for (const q of useQuoteBoxes(pages, sources)) byPage.set(q.page, [...(byPage.get(q.page) ?? []), q]);

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
                <span key={q.quote} className={q.boxes || !q.loaded ? "muted" : "bad"}>
                  “{q.quote}”{q.boxes || !q.loaded ? "" : " (not found)"}{" "}
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
