import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { useMapReview } from "../shared/reviews";
import { usePatternParam } from "../shared/usePatternParam";
import { MapOutline, type Selection } from "./MapOutline";
import { MapPageCard } from "./MapPageCard";
import { MapReader } from "./MapReader";
import { onPage, regionBoxes } from "./regions";

type Mode = "text" | "pages";

/**
 * Reviewing stage 1 maps: the map's outline on the left, pages with their
 * roles on the right. Selecting a section or chart, or clicking a page, opens
 * a full-width reading view with exact highlights. Reviews are per pattern,
 * so they score every input mode.
 */
export function MapInspector() {
  const [mode, setMode] = useState<Mode>("text");
  const index = useQuery(api.maps.list);
  const listed = index?.filter((e) => e.mode === mode);
  const [pattern, setPattern] = usePatternParam(listed?.map((e) => e.pattern));
  const saved = useQuery(api.maps.get, pattern ? { pattern, mode } : "skip");
  const pages = useQuery(api.pages.forPattern, pattern ? { pattern } : "skip");
  const [review, onReview] = useMapReview(pattern);
  const [selected, setSelected] = useState<Selection>(null);
  const [openPage, setOpenPage] = useState<number | null>(null);

  const regions = useMemo(() => regionBoxes(pages ?? []), [pages]);
  const highlight = useMemo(() => {
    const map = saved?.map;
    if (!map || !selected) return { pages: new Set<number>(), regions: new Set<string>() };
    const charts = selected.kind === "section" ? map.charts.filter((c) => map.sections.find((s) => s.id === selected.id)?.chartIds.includes(c.id)) : map.charts.filter((c) => c.id === selected.id);
    const pagesLit = selected.kind === "section" ? (map.sections.find((s) => s.id === selected.id)?.pages ?? []) : charts.flatMap((c) => c.writtenPages);
    return { pages: new Set(pagesLit), regions: new Set(charts.flatMap((c) => [...c.regionIds, ...c.legendRegionIds])) };
  }, [saved, selected]);

  const choose = (p: string) => {
    setPattern(p);
    setSelected(null);
    setOpenPage(null);
  };

  return (
    <div className="inspector">
      <aside>
        <h1>Document map</h1>
        <div className="modes">
          {(["text", "pages"] as const).map((m) => (
            <button key={m} className={m === mode ? "on" : ""} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        {listed?.length === 0 && <p className="muted small">No maps in this mode. Run: npx tsx scripts/map.ts &lt;pattern&gt;</p>}
        <ul>
          {listed?.map((e) => (
            <li key={e.pattern} className={e.pattern === pattern ? "active" : ""} onClick={() => choose(e.pattern)}>
              <div className="name">{e.title || e.pattern}</div>
              <div className="meta">
                {e.sections} sections · {e.charts} charts · {Math.round(e.inputTokens / 1000)}k in
                {e.problems > 0 && <b className="bad"> · {e.problems} problems</b>}
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="map-main">
        {saved && pages && (
          <>
            <MapOutline saved={saved} review={review} onReview={onReview} selected={selected} onSelect={(s) => (setSelected(s), setOpenPage(null))} />
            {selected || openPage !== null ? (
              <MapReader
                map={saved.map}
                pages={pages}
                regions={regions}
                target={openPage !== null ? { kind: "page", page: openPage } : selected!}
                onClose={() => (setSelected(null), setOpenPage(null))}
              />
            ) : (
              <div className="grid map-pages">
                {pages.map((p) => (
                  <MapPageCard
                    key={p._id}
                    p={p}
                    map={saved.map}
                    regions={onPage(regions, p.page)}
                    review={review}
                    onReview={onReview}
                    highlight={{ page: highlight.pages.has(p.page), regions: highlight.regions }}
                    showDoc={p.doc !== pages[0].doc}
                    onOpen={() => setOpenPage(p.page)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
