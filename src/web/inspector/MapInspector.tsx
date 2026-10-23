import { useCallback, useEffect, useMemo, useState } from "react";
import { PAGE_ROLES, type DocMap, type PageRole } from "../../extract/docMap";
import type { PageRef } from "../../extract/patterns";
import {
  scoreMap,
  type MapFixture,
  type Verdict,
} from "../../extract/mapFixture";
import type { BBox } from "../../extract/pageData";
import { regionIds, type PageTriage } from "../../extract/triage";
import { MapReader } from "./MapReader";

/**
 * Dev tool for reviewing stage 1 document maps: the map's outline on the left,
 * pages with their roles on the right. Selecting a section or chart, or
 * clicking a page, opens a full-width reading view with exact highlights.
 * Reviews save to fixtures/map.
 */

interface IndexEntry {
  mode: string;
  pattern: string;
  title: string;
  sections: number;
  charts: number;
  problems: number;
  inputTokens: number;
}

interface MapFile {
  map: DocMap;
  pages: PageRef[];
  problems: string[];
  usage: { input_tokens: number; output_tokens: number };
}

type Selection = { kind: "section" | "chart"; id: string } | null;

const pageImg = (p: PageRef) =>
  `/data/raw/${p.doc}/pages/p${String(p.docPage).padStart(2, "0")}.png`;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function MapInspector({
  initial,
  onSelect,
}: {
  initial: string | null;
  onSelect: (p: string) => void;
}) {
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [pattern, setPattern] = useState<string | null>(initial);
  /** Input mode the map was built with; reviews are per pattern, so they score every mode. */
  const [mode, setMode] = useState<string>("text");
  const [file, setFile] = useState<MapFile | null>(null);
  /** Region boxes by global region id ("p7.c1"). */
  const [regions, setRegions] = useState<Record<string, BBox>>({});
  const [fixture, setFixture] = useState<MapFixture>({});
  const [selected, setSelected] = useState<Selection>(null);
  const [openPage, setOpenPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<IndexEntry[]>("/data/map/index.json")
      .then((ix) => {
        setIndex(ix);
        setPattern((p) =>
          p && ix.some((e) => e.pattern === p) ? p : (ix[0]?.pattern ?? null),
        );
      })
      .catch((e) => setError(`${e}. Run: npx tsx scripts/map.ts <pattern>`));
  }, []);

  useEffect(() => {
    if (!pattern) return;
    onSelect(pattern);
    setSelected(null);
    setOpenPage(null);
    (async () => {
      const f = await getJson<MapFile>(`/data/map/${mode}/${pattern}.json`);
      const docs = [...new Set(f.pages.map((p) => p.doc))];
      const boxes: Record<string, BBox> = {};
      for (const doc of docs) {
        const triage = await getJson<PageTriage[]>(`/data/triage/${doc}.json`);
        for (const t of triage) {
          const ref = f.pages.find(
            (p) => p.doc === doc && p.docPage === t.page,
          )!;
          const ids = regionIds({ ...t, page: ref.page });
          for (const c of ids.charts) boxes[c.id] = c.region.bbox;
          for (const im of ids.images) boxes[im.id] = im.bbox;
        }
      }
      setFile(f);
      setRegions(boxes);
      setFixture(await getJson<MapFixture>(`/api/fixtures/map/${pattern}`));
    })().catch((e) => setError(String(e)));
  }, [pattern, mode, onSelect]);

  const update = useCallback(
    (fn: (f: MapFixture) => MapFixture) => {
      if (!pattern) return;
      setFixture((prev) => {
        const next = fn(prev);
        fetch(`/api/fixtures/map/${pattern}`, {
          method: "PUT",
          body: JSON.stringify(next),
        }).catch((e) => setError(String(e)));
        return next;
      });
    },
    [pattern],
  );

  const highlight = useMemo(() => {
    if (!file || !selected)
      return { pages: new Set<number>(), regions: new Set<string>() };
    if (selected.kind === "section") {
      const s = file.map.sections.find((x) => x.id === selected.id);
      const charts = file.map.charts.filter((c) => s?.chartIds.includes(c.id));
      return {
        pages: new Set(s?.pages ?? []),
        regions: new Set(
          charts.flatMap((c) => [...c.regionIds, ...c.legendRegionIds]),
        ),
      };
    }
    const c = file.map.charts.find((x) => x.id === selected.id);
    return {
      pages: new Set(c?.writtenPages ?? []),
      regions: new Set([
        ...(c?.regionIds ?? []),
        ...(c?.legendRegionIds ?? []),
      ]),
    };
  }, [file, selected]);

  const map = file?.map;
  return (
    <div className="inspector">
      <aside>
        <h1>Document map</h1>
        <div className="modes">
          {[...new Set(index.map((e) => e.mode))].map((m) => (
            <button
              key={m}
              className={m === mode ? "on" : ""}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <ul>
          {index
            .filter((e) => e.mode === mode)
            .map((e) => (
              <li
                key={e.pattern}
                className={e.pattern === pattern ? "active" : ""}
                onClick={() => setPattern(e.pattern)}
              >
                <div className="name">{e.title || e.pattern}</div>
                <div className="meta">
                  {e.sections} sections · {e.charts} charts ·{" "}
                  {Math.round(e.inputTokens / 1000)}k in
                  {e.problems > 0 && (
                    <b className="bad"> · {e.problems} problems</b>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </aside>

      <main className="map-main">
        {error && <div className="error">{error}</div>}
        {map && file && (
          <>
            <div className="outline">
              <h2>{map.title}</h2>
              <p className="meta">
                {map.designer} · {file.usage.input_tokens.toLocaleString()} in /{" "}
                {file.usage.output_tokens.toLocaleString()} out
              </p>
              <Score map={map} fixture={fixture} />
              <ReviewRow
                label="Metadata"
                v={fixture.meta}
                onChange={(v) => update((f) => ({ ...f, meta: v }))}
              />
              <dl>
                <dt>Sizes</dt>
                <dd>
                  {map.sizes.join(" · ")}{" "}
                  <span className="muted">({map.sizeNotation})</span>
                </dd>
                {map.options.length > 0 && (
                  <>
                    <dt>Options</dt>
                    <dd>
                      {map.options.map((o) => (
                        <div key={o.name}>
                          {o.name}: {o.choices.join(" / ")}
                        </div>
                      ))}
                    </dd>
                  </>
                )}
                <dt>Construction</dt>
                <dd>{map.construction}</dd>
              </dl>

              <h3>Sections</h3>
              <ol className="items">
                {map.sections.map((s) => (
                  <li
                    key={s.id}
                    className={
                      selected?.kind === "section" && selected.id === s.id
                        ? "selected"
                        : ""
                    }
                    onClick={() => (
                      setSelected({ kind: "section", id: s.id }),
                      setOpenPage(null)
                    )}
                  >
                    <div>
                      <b>{s.title}</b>{" "}
                      <span className="muted">p{s.pages.join(", ")}</span>
                      {s.repeat && <span className="tag">{s.repeat}</span>}
                      {s.choices.map((c) => (
                        <span key={c} className="tag">
                          {c}
                        </span>
                      ))}
                      {s.chartIds.map((c) => (
                        <span key={c} className="tag chart">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="muted small">{s.summary}</div>
                    <ReviewRow
                      v={fixture.sections?.[s.id]}
                      onChange={(v) =>
                        update((f) => ({
                          ...f,
                          sections: withVerdict(f.sections, s.id, v),
                        }))
                      }
                    />
                  </li>
                ))}
              </ol>

              <h3>Charts</h3>
              <ul className="items">
                {map.charts.map((c) => (
                  <li
                    key={c.id}
                    className={
                      selected?.kind === "chart" && selected.id === c.id
                        ? "selected"
                        : ""
                    }
                    onClick={() => (
                      setSelected({ kind: "chart", id: c.id }),
                      setOpenPage(null)
                    )}
                  >
                    <div>
                      <b>{c.title}</b> <span className="tag chart">{c.id}</span>
                    </div>
                    <div className="muted small">
                      regions {c.regionIds.join(", ") || "—"} · legend{" "}
                      {c.legendRegionIds.join(", ") || "—"} · sizes{" "}
                      {c.sizes.length
                        ? c.sizes.map((i) => map.sizes[i] ?? `#${i}`).join(", ")
                        : "all"}{" "}
                      · {c.readDirection}
                      {c.writtenPages.length > 0 &&
                        ` · written on p${c.writtenPages.join(", ")}`}
                    </div>
                    <ReviewRow
                      v={fixture.charts?.[c.id]}
                      onChange={(v) =>
                        update((f) => ({
                          ...f,
                          charts: withVerdict(f.charts, c.id, v),
                        }))
                      }
                    />
                  </li>
                ))}
              </ul>

              {map.techniques.length > 0 && (
                <>
                  <h3>Techniques</h3>
                  <p className="small">
                    {map.techniques
                      .map((t) => `${t.name} (p${t.page})`)
                      .join(" · ")}
                  </p>
                </>
              )}
              {(map.reviewNotes.length > 0 || file.problems.length > 0) && (
                <>
                  <h3>Notes</h3>
                  <ul className="small">
                    {file.problems.map((p) => (
                      <li key={p} className="bad">
                        {p}
                      </li>
                    ))}
                    {map.reviewNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              <textarea
                placeholder="Overall notes on this map"
                value={fixture.note ?? ""}
                onChange={(e) =>
                  update((f) => ({ ...f, note: e.target.value || undefined }))
                }
              />
            </div>

            {selected || openPage !== null ? (
              <MapReader
                map={map}
                pages={file.pages}
                regions={regions}
                target={
                  openPage !== null
                    ? { kind: "page", page: openPage }
                    : selected!
                }
                onClose={() => (setSelected(null), setOpenPage(null))}
              />
            ) : (
              <div className="grid map-pages">
                {file.pages.map((ref) => {
                  const info = map.pages.find((p) => p.page === ref.page);
                  const reviewed = fixture.pages?.[ref.page]?.roles;
                  const roles = reviewed ?? info?.roles ?? [];
                  const changed =
                    reviewed &&
                    info &&
                    [...reviewed].sort().join() !==
                      [...info.roles].sort().join();
                  const pageRegions = Object.entries(regions).filter(([id]) =>
                    id.startsWith(`p${ref.page}.`),
                  );
                  return (
                    <figure
                      key={ref.page}
                      className={`card ${highlight.pages.has(ref.page) ? "hl" : ""} ${reviewed ? (changed ? "wrong" : "ok") : ""}`}
                    >
                      <div
                        className="page"
                        onClick={() => setOpenPage(ref.page)}
                        style={{ cursor: "zoom-in" }}
                      >
                        <img
                          src={pageImg(ref)}
                          loading="lazy"
                          alt={`page ${ref.page}`}
                        />
                        {pageRegions.map(([id, b]) => (
                          <div
                            key={id}
                            className={`box region ${highlight.regions.has(id) ? "on" : ""}`}
                            style={{
                              left: `${b[0] * 100}%`,
                              top: `${b[1] * 100}%`,
                              width: `${(b[2] - b[0]) * 100}%`,
                              height: `${(b[3] - b[1]) * 100}%`,
                            }}
                          >
                            <span>{id}</span>
                          </div>
                        ))}
                      </div>
                      <figcaption>
                        <span>p{ref.page}</span>
                        {ref.doc !== file.pages[0].doc && (
                          <span className="muted">
                            {ref.doc} p{ref.docPage}
                          </span>
                        )}
                      </figcaption>
                      <div className="roles">
                        {PAGE_ROLES.map((r) => (
                          <button
                            key={r}
                            className={`role ${roles.includes(r) ? "on" : ""} ${info?.roles.includes(r) ? "model" : ""}`}
                            title={
                              info?.roles.includes(r)
                                ? "model said yes"
                                : "model said no"
                            }
                            onClick={() =>
                              update((f) => ({
                                ...f,
                                pages: {
                                  ...f.pages,
                                  [ref.page]: { roles: toggle(roles, r) },
                                },
                              }))
                            }
                          >
                            {r}
                          </button>
                        ))}
                        {!reviewed && info && (
                          <button
                            className="role accept"
                            onClick={() =>
                              update((f) => ({
                                ...f,
                                pages: {
                                  ...f.pages,
                                  [ref.page]: { roles: info.roles },
                                },
                              }))
                            }
                          >
                            ✓ roles right
                          </button>
                        )}
                      </div>
                      <div className="small muted summary">{info?.summary}</div>
                    </figure>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Score({ map, fixture }: { map: DocMap; fixture: MapFixture }) {
  const s = scoreMap(map, fixture);
  if (s.pages.total + s.items.total === 0)
    return <p className="meta">Not reviewed yet</p>;
  return (
    <p className="meta">
      Reviewed: page roles {s.pages.right}/{s.pages.total} right ·
      sections/charts/meta {s.items.right}/{s.items.total} marked right
    </p>
  );
}

const toggle = (roles: PageRole[], r: PageRole) =>
  roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];

function withVerdict(
  prev: Record<string, Verdict> | undefined,
  id: string,
  v: Verdict | undefined,
) {
  const next = { ...prev };
  if (v) next[id] = v;
  else delete next[id];
  return next;
}

function ReviewRow({
  label,
  v,
  onChange,
}: {
  label?: string;
  v?: Verdict;
  onChange: (v: Verdict | undefined) => void;
}) {
  return (
    <div className="review" onClick={(e) => e.stopPropagation()}>
      {label && <span className="small">{label}</span>}
      <button
        className={v?.ok === true ? "on good" : ""}
        onClick={() =>
          onChange(v?.ok === true ? undefined : { ...v, ok: true })
        }
      >
        ✓
      </button>
      <button
        className={v?.ok === false ? "on bad" : ""}
        onClick={() =>
          onChange(v?.ok === false ? undefined : { ...v, ok: false })
        }
      >
        ✗
      </button>
      {v?.ok === false && (
        <input
          placeholder="what's wrong?"
          value={v.note ?? ""}
          onChange={(e) =>
            onChange({ ...v, note: e.target.value || undefined })
          }
        />
      )}
    </div>
  );
}
