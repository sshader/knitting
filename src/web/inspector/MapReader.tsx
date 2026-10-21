import { useEffect, useMemo, useState } from "react";
import { locateSections, rangeBoxes } from "../../extract/anchors";
import type { DocMap } from "../../extract/docMap";
import type { PageRef } from "../../extract/mapInput";
import type { BBox, PageData } from "../../extract/pageData";

/**
 * Full-width reading view for one map item: a section's pages with exactly its
 * text highlighted (from its start quote to the next section's), plus its
 * charts; a chart's pages with its regions; or a single page.
 */

export type ReaderTarget = { kind: "section" | "chart"; id: string } | { kind: "page"; page: number };

const pageJson = (p: PageRef) => `/data/raw/${p.doc}/pages/p${String(p.docPage).padStart(2, "0")}.json`;
const pageImg = (p: PageRef) => `/data/raw/${p.doc}/pages/p${String(p.docPage).padStart(2, "0")}.png`;

export function MapReader({
  map,
  pages,
  regions,
  target,
  onClose,
}: {
  map: DocMap;
  pages: PageRef[];
  regions: Record<string, BBox>;
  target: ReaderTarget;
  onClose: () => void;
}) {
  const [data, setData] = useState<Map<number, PageData>>(new Map());

  // Pages whose words we need to place section anchors.
  const anchorPages = useMemo(() => new Set(map.sections.map((s) => s.startPage)), [map]);

  const view = useMemo(() => {
    if (target.kind === "page") return { pages: [target.page], regionIds: new Set<string>(), section: null };
    if (target.kind === "chart") {
      const c = map.charts.find((x) => x.id === target.id);
      const ids = [...(c?.regionIds ?? []), ...(c?.legendRegionIds ?? [])];
      const regionPages = ids.map((id) => Number(/^p(\d+)/.exec(id)?.[1]));
      return { pages: uniq([...regionPages, ...(c?.writtenPages ?? [])]), regionIds: new Set(ids), section: null };
    }
    const i = map.sections.findIndex((x) => x.id === target.id);
    const s = map.sections[i];
    const next = map.sections[i + 1];
    const charts = map.charts.filter((c) => s?.chartIds.includes(c.id));
    const ids = charts.flatMap((c) => [...c.regionIds, ...c.legendRegionIds]);
    const last = Math.max(...(s?.pages ?? []), next && next.startPage >= (s?.startPage ?? 0) ? next.startPage : 0);
    const textPages = s ? range(s.startPage, last) : [];
    const chartPages = ids.map((id) => Number(/^p(\d+)/.exec(id)?.[1]));
    return { pages: uniq([...textPages, ...(s?.pages ?? []), ...chartPages]), regionIds: new Set(ids), section: s ? { s, next } : null };
  }, [map, target]);

  useEffect(() => {
    const need = uniq([...view.pages, ...anchorPages]).filter((n) => !data.has(n));
    if (need.length === 0) return;
    Promise.all(
      need.map(async (n) => {
        const ref = pages.find((p) => p.page === n);
        return ref ? ([n, (await (await fetch(pageJson(ref))).json()) as PageData] as const) : null;
      }),
    ).then((loaded) => setData((prev) => new Map([...prev, ...loaded.filter((x) => x !== null)])));
  }, [view, anchorPages, pages, data]);

  // Line boxes for the section's text: from its start quote to the next section's.
  const { textBoxes, missing } = useMemo(() => {
    const out = new Map<number, BBox[]>();
    if (!view.section) return { textBoxes: out, missing: null };
    const { s } = view.section;
    const i = map.sections.indexOf(s);
    const positions = locateSections(map.sections, (n) => data.get(n));
    const start = positions[i];
    if (!start) return { textBoxes: out, missing: data.has(s.startPage) ? s.startQuote : null };
    const end = positions[i + 1] ?? null;
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
        const ref = pages.find((p) => p.page === n);
        if (!ref) return null;
        const info = map.pages.find((p) => p.page === n);
        return (
          <figure key={n} className="reader-page">
            <figcaption>
              <b>p{n}</b> {info?.roles.join(" · ")} <span className="muted">— {info?.summary}</span>
            </figcaption>
            <div className="page">
              <img src={pageImg(ref)} alt={`page ${n}`} />
              {(textBoxes.get(n) ?? []).map((b, i) => (
                <div key={`t${i}`} className="box text-hl" style={box(b)} />
              ))}
              {Object.entries(regions)
                .filter(([id]) => id.startsWith(`p${n}.`))
                .map(([id, b]) => (
                  <div key={id} className={`box region ${view.regionIds.has(id) ? "on" : ""}`} style={box(b)}>
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

const box = (b: BBox) => ({
  left: `${b[0] * 100}%`,
  top: `${b[1] * 100}%`,
  width: `${(b[2] - b[0]) * 100}%`,
  height: `${(b[3] - b[1]) * 100}%`,
});
const uniq = (xs: number[]) => [...new Set(xs.filter((x) => Number.isFinite(x)))].sort((a, b) => a - b);
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
