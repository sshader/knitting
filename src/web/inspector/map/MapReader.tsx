import { useMemo } from "react";
import { locateSections, rangeBoxes } from "../../../extract/anchors";
import type { DocMap } from "../../../extract/docMap";
import type { BBox } from "../../../extract/pageData";
import { boxStyle } from "../shared/box";
import type { PageRow } from "../shared/types";
import { usePageData } from "../shared/usePageData";
import { onPage } from "./regions";

/**
 * Full-width reading view for one map item: a section's pages with exactly its
 * text highlighted (from its start quote to the next section's), plus its
 * charts; a chart's pages with its regions; or a single page.
 */

export type ReaderTarget = { kind: "section" | "chart"; id: string } | { kind: "page"; page: number };

export function MapReader({
  map,
  pages,
  regions,
  target,
  onClose,
}: {
  map: DocMap;
  pages: PageRow[];
  regions: Record<string, BBox>;
  target: ReaderTarget;
  onClose: () => void;
}) {
  const view = useMemo(() => readerView(map, target), [map, target]);
  // Section anchors are found in page words, so load every page a section starts on too.
  const data = usePageData(pages, [...view.pages, ...map.sections.map((s) => s.startPage)]);

  // Line boxes for the section's text: from its start quote to the next section's.
  const { textBoxes, missing } = useMemo(() => {
    const out = new Map<number, BBox[]>();
    if (!view.section) return { textBoxes: out, missing: null };
    const { s } = view.section;
    const positions = locateSections(map.sections, (n) => data.get(n));
    const start = positions[map.sections.indexOf(s)];
    if (!start) return { textBoxes: out, missing: data.has(s.startPage) ? s.startQuote : null };
    const end = positions[map.sections.indexOf(s) + 1] ?? null;
    const textData = new Map([...data].filter(([n]) => view.pages.includes(n)));
    for (const { page, boxes } of rangeBoxes(textData, start, end)) out.set(page, boxes);
    return { textBoxes: out, missing: null };
  }, [view, data, map]);

  const title =
    target.kind === "page"
      ? `Page ${target.page}`
      : target.kind === "chart"
        ? map.charts.find((c) => c.id === target.id)?.title
        : map.sections.find((s) => s.id === target.id)?.title;

  return (
    <div className="reader">
      <header>
        <button onClick={onClose}>← all pages</button>
        <b>{title}</b>
        {view.section && (
          <span className="muted small">
            starts p{view.section.s.startPage} at “{view.section.s.startQuote}”
          </span>
        )}
        {missing && <span className="bad small">start quote not found: “{missing}”</span>}
      </header>
      {view.pages.map((n) => {
        const p = pages.find((x) => x.page === n);
        if (!p) return null;
        const info = map.pages.find((x) => x.page === n);
        return (
          <figure key={n} className="reader-page">
            <figcaption>
              <b>p{n}</b> {info?.roles.join(" · ")} <span className="muted">— {info?.summary}</span>
            </figcaption>
            <div className="page">
              <img src={p.pngUrl} alt={`page ${n}`} />
              {(textBoxes.get(n) ?? []).map((b, i) => (
                <div key={`t${i}`} className="box text-hl" style={boxStyle(b)} />
              ))}
              {onPage(regions, n).map(([id, b]) => (
                <div key={id} className={`box region ${view.regionIds.has(id) ? "on" : ""}`} style={boxStyle(b)}>
                  <span>{id}</span>
                </div>
              ))}
            </div>
          </figure>
        );
      })}
    </div>
  );
}

/** Which pages to show for a target, which regions to light up, and the section (with the next one) if it's a section. */
function readerView(map: DocMap, target: ReaderTarget) {
  const pageOf = (regionId: string) => Number(/^p(\d+)/.exec(regionId)?.[1]);
  if (target.kind === "page") return { pages: [target.page], regionIds: new Set<string>(), section: null };
  if (target.kind === "chart") {
    const c = map.charts.find((x) => x.id === target.id);
    const ids = [...(c?.regionIds ?? []), ...(c?.legendRegionIds ?? [])];
    return { pages: uniq([...ids.map(pageOf), ...(c?.writtenPages ?? [])]), regionIds: new Set(ids), section: null };
  }
  const i = map.sections.findIndex((x) => x.id === target.id);
  const s = map.sections[i];
  const next = map.sections[i + 1];
  const ids = map.charts.filter((c) => s?.chartIds.includes(c.id)).flatMap((c) => [...c.regionIds, ...c.legendRegionIds]);
  const last = Math.max(...(s?.pages ?? []), next && next.startPage >= (s?.startPage ?? 0) ? next.startPage : 0);
  const textPages = s ? range(s.startPage, last) : [];
  return { pages: uniq([...textPages, ...(s?.pages ?? []), ...ids.map(pageOf)]), regionIds: new Set(ids), section: s ? { s, next } : null };
}

const uniq = (xs: number[]) => [...new Set(xs.filter((x) => Number.isFinite(x)))].sort((a, b) => a - b);
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
