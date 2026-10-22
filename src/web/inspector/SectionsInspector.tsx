import { useCallback, useEffect, useMemo, useState } from "react";
import { findQuoteSpan } from "../../extract/anchors";
import type { DocMap } from "../../extract/docMap";
import type { Verdict } from "../../extract/mapFixture";
import type { PageRef } from "../../extract/mapInput";
import type { BBox, PageData } from "../../extract/pageData";
import { inReadingOrder } from "../../extract/readingOrder";
import type { FlatNode, SectionExtraction } from "../../extract/sectionSchema";
import { appliesToSize, textForSize } from "../../shared/sized";

/**
 * Dev tool for reviewing stage 2: a section's extracted nodes next to the
 * page each one came from, with its quote highlighted. A size picker shows
 * the instructions as a knitter of that size would read them. Reviews save
 * to fixtures/sections/<pattern>.json.
 */

interface MapIndexEntry {
  mode: string;
  pattern: string;
  title: string;
}

interface SectionFile {
  section: string;
  extraction?: SectionExtraction;
  problems?: string[];
  error?: string;
  usage: { output_tokens: number };
  seconds: number;
}

/** Reviews: per node, plus "section:<id>" for whole-section verdicts. */
type SectionsFixture = Record<string, Verdict>;

const ALL = -1;

async function getJson<T>(url: string): Promise<T | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

export function SectionsInspector({ initial, onSelect }: { initial: string | null; onSelect: (p: string) => void }) {
  const [index, setIndex] = useState<MapIndexEntry[]>([]);
  const [pattern, setPattern] = useState<string | null>(initial);
  const [map, setMap] = useState<{ map: DocMap; pages: PageRef[] } | null>(null);
  const [files, setFiles] = useState<Record<string, SectionFile | null>>({});
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [size, setSize] = useState(ALL);
  const [fixture, setFixture] = useState<SectionsFixture>({});

  useEffect(() => {
    getJson<MapIndexEntry[]>("/data/map/index.json").then((ix) => {
      const text = (ix ?? []).filter((e) => e.mode === "text");
      setIndex(text);
      setPattern((p) => p ?? text[0]?.pattern ?? null);
    });
  }, []);

  useEffect(() => {
    if (!pattern) return;
    onSelect(pattern);
    setSectionId(null);
    setNodeId(null);
    setSize(ALL);
    (async () => {
      const m = await getJson<{ map: DocMap; pages: PageRef[] }>(`/data/map/text/${pattern}.json`);
      setMap(m);
      if (!m) return;
      const loaded = await Promise.all(m.map.sections.map(async (s) => [s.id, await getJson<SectionFile>(`/data/sections/${pattern}/${s.id}.json`)] as const));
      setFiles(Object.fromEntries(loaded));
      setSectionId(m.map.sections[0]?.id ?? null);
      setFixture((await getJson<SectionsFixture>(`/api/fixtures/sections/${pattern}`)) ?? {});
    })();
  }, [pattern, onSelect]);

  const update = useCallback(
    (key: string, v: Verdict | undefined) => {
      if (!pattern) return;
      setFixture((prev) => {
        const next = { ...prev };
        if (v) next[key] = v;
        else delete next[key];
        fetch(`/api/fixtures/sections/${pattern}`, { method: "PUT", body: JSON.stringify(next) });
        return next;
      });
    },
    [pattern],
  );

  const file = sectionId ? files[sectionId] : null;
  const nodes = file?.extraction?.nodes ?? [];
  const node = nodes.find((n) => n.id === nodeId) ?? null;

  return (
    <div className="inspector">
      <aside>
        <h1>Sections</h1>
        <ul>
          {index.map((e) => (
            <li key={e.pattern} className={e.pattern === pattern ? "active" : ""} onClick={() => setPattern(e.pattern)}>
              <div className="name">{e.title || e.pattern}</div>
            </li>
          ))}
        </ul>
        {map && (
          <>
            <h3>Sections</h3>
            <ol className="items">
              {map.map.sections.map((s) => {
                const f = files[s.id];
                const v = fixture[`section:${s.id}`];
                return (
                  <li key={s.id} className={s.id === sectionId ? "selected" : ""} onClick={() => (setSectionId(s.id), setNodeId(null))}>
                    <b>{s.title}</b> {v && <span className={v.ok ? "good" : "bad"}>{v.ok ? "✓" : "✗"}</span>}
                    <div className="small muted">
                      {f?.extraction
                        ? `${f.extraction.nodes.length} nodes · ${f.problems?.length ?? 0} problems · ${f.extraction.reviewNotes.length} notes`
                        : f?.error
                          ? `failed: ${f.error}`
                          : "not extracted"}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </aside>

      <main className="sections-main">
        <div className="nodes">
          {map && sectionId && (
            <>
              <header className="nodes-header">
                <b>{map.map.sections.find((s) => s.id === sectionId)?.title}</b>
                <label>
                  Size{" "}
                  <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                    <option value={ALL}>all (raw)</option>
                    {map.map.sizes.map((s, i) => (
                      <option key={i} value={i}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <SectionReview v={fixture[`section:${sectionId}`]} onChange={(v) => update(`section:${sectionId}`, v)} />
              </header>
              {file?.extraction && file.extraction.times.length > 0 && <p className="small">Section worked {JSON.stringify(file.extraction.times)} times</p>}
              {(file?.problems?.length ?? 0) > 0 && (
                <ul className="small bad">
                  {file!.problems!.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {file?.extraction && file.extraction.reviewNotes.length > 0 && (
                <details className="small" open>
                  <summary>Model's review notes ({file.extraction.reviewNotes.length})</summary>
                  <ul>
                    {file.extraction.reviewNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </details>
              )}
              <ol className="node-list">
                {nodes
                  .filter((n) => size === ALL || appliesToSize(n.sizes, size))
                  .map((n) => (
                    <NodeRow
                      key={n.id}
                      n={n}
                      depth={depth(nodes, n)}
                      map={map.map}
                      size={size}
                      selected={n.id === nodeId}
                      verdict={fixture[n.id]}
                      onSelect={() => setNodeId(n.id)}
                      onReview={(v) => update(n.id, v)}
                    />
                  ))}
              </ol>
            </>
          )}
        </div>
        <div className="source">
          {node && map ? <SourceView node={node} pages={map.pages} /> : <p className="muted">Select a node to see where it came from.</p>}
        </div>
      </main>
    </div>
  );
}

function depth(nodes: FlatNode[], n: FlatNode): number {
  let d = 0;
  for (let p = n.parentId; p; p = nodes.find((x) => x.id === p)?.parentId ?? "") d++;
  return d;
}

const fmt = (xs: number[], size: number) => (xs.length === 0 ? "" : size === ALL || xs.length === 1 ? xs.join("|") : String(xs[size]));

function NodeRow({
  n,
  depth,
  map,
  size,
  selected,
  verdict,
  onSelect,
  onReview,
}: {
  n: FlatNode;
  depth: number;
  map: DocMap;
  size: number;
  selected: boolean;
  verdict?: Verdict;
  onSelect: () => void;
  onReview: (v: Verdict | undefined) => void;
}) {
  const text = size === ALL ? n.text : textForSize(n.text, size);
  const chart = n.chartRefs
    .map((r) => (size === ALL || r.ids.length === 1 ? (r.ids.length > 1 ? `[${r.ids.join("|")}]` : r.ids[0]) : r.ids[size]))
    .filter(Boolean)
    .join(" + ");
  const rows = [fmt(n.fromRow, size), fmt(n.toRow, size)].filter(Boolean).join("–");
  return (
    <li className={`node ${n.kind} ${selected ? "selected" : ""} ${verdict ? (verdict.ok ? "ok" : "wrong") : ""}`} style={{ marginLeft: depth * 20 }} onClick={onSelect}>
      <div className="node-head">
        <span className={`kind ${n.kind}`}>{n.kind}</span>
        {(n.label || n.title) && <b>{n.title || n.label}</b>}
        {n.side !== "none" && <span className="tag">{n.side}</span>}
        {n.rows.length > 0 && fmt(n.rows, size) !== "1" && <span className="tag">× {fmt(n.rows, size)} rows</span>}
        {n.times.length > 0 && <span className="tag">× {fmt(n.times, size)}</span>}
        {n.until && <span className="tag">until {n.until}</span>}
        {chart && (
          <span className="tag chart">
            {chart}
            {rows && ` r${rows}`}
          </span>
        )}
        {n.sizes.length > 0 && <span className="tag">sizes {n.sizes.map((i) => map.sizes[i]).join(", ")}</span>}
        {n.choices.map((c) => (
          <span key={c} className="tag">
            {c}
          </span>
        ))}
        {n.stitchCount.length > 0 && <span className="tag">= {fmt(n.stitchCount, size)} sts</span>}
        <span className="review-inline" onClick={(e) => e.stopPropagation()}>
          <button className={verdict?.ok === true ? "on good" : ""} onClick={() => onReview(verdict?.ok === true ? undefined : { ok: true })}>
            ✓
          </button>
          <button className={verdict?.ok === false ? "on bad" : ""} onClick={() => onReview(verdict?.ok === false ? undefined : { ok: false })}>
            ✗
          </button>
        </span>
      </div>
      {text && <div className="node-text">{text}</div>}
      {n.overlays.map((o) => (
        <div key={o.id} className="overlay small">
          ↳ at the same time: {size === ALL ? o.text : textForSize(o.text, size)} — first row {fmt(o.first, size)}
          {o.every.length > 0 && `, every ${fmt(o.every, size)}`}
          {o.count.length > 0 && `, ${fmt(o.count, size)} times`}
        </div>
      ))}
      {verdict?.ok === false && (
        <input
          className="note-input"
          placeholder="what's wrong?"
          value={verdict.note ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onReview({ ok: false, note: e.target.value || undefined })}
        />
      )}
    </li>
  );
}

function SectionReview({ v, onChange }: { v?: Verdict; onChange: (v: Verdict | undefined) => void }) {
  return (
    <span className="review">
      <span className="small">Section</span>
      <button className={v?.ok === true ? "on good" : ""} onClick={() => onChange(v?.ok === true ? undefined : { ok: true })}>
        ✓
      </button>
      <button className={v?.ok === false ? "on bad" : ""} onClick={() => onChange(v?.ok === false ? undefined : { ok: false })}>
        ✗
      </button>
      {v?.ok === false && <input placeholder="what's wrong?" value={v.note ?? ""} onChange={(e) => onChange({ ok: false, note: e.target.value || undefined })} />}
    </span>
  );
}

/** The node's source pages with each quote highlighted. */
function SourceView({ node, pages }: { node: FlatNode; pages: PageRef[] }) {
  const [data, setData] = useState<Record<number, PageData>>({});
  const srcs = useMemo(() => [...node.source, ...node.overlays.flatMap((o) => o.source)], [node]);

  useEffect(() => {
    for (const s of srcs) {
      const ref = pages.find((p) => p.page === s.page);
      if (!ref || data[s.page]) continue;
      fetch(`/data/raw/${ref.doc}/pages/p${String(ref.docPage).padStart(2, "0")}.json`)
        .then((r) => r.json())
        .then((d: PageData) => setData((prev) => ({ ...prev, [s.page]: d })));
    }
  }, [srcs, pages, data]);

  const byPage = new Map<number, { quote: string; boxes: BBox[] | null }[]>();
  for (const s of srcs) {
    const d = data[s.page];
    let boxes: BBox[] | null = null;
    if (d) {
      const span = findQuoteSpan(d, s.quote);
      const words = inReadingOrder(d).words;
      boxes = span ? words.slice(span.start, span.end + 1).map((w) => w.b) : null;
    }
    byPage.set(s.page, [...(byPage.get(s.page) ?? []), { quote: s.quote, boxes }]);
  }

  return (
    <>
      {[...byPage].map(([page, quotes]) => {
        const ref = pages.find((p) => p.page === page);
        if (!ref) return <p key={page}>page {page} not found</p>;
        return (
          <figure key={page} className="reader-page">
            <figcaption>
              <b>p{page}</b>{" "}
              {quotes.map((q) => (
                <span key={q.quote} className={q.boxes ? "muted" : "bad"}>
                  “{q.quote}”{q.boxes ? "" : " (not found)"}{" "}
                </span>
              ))}
            </figcaption>
            <div className="page">
              <img src={`/data/raw/${ref.doc}/pages/p${String(ref.docPage).padStart(2, "0")}.png`} alt={`page ${page}`} />
              {quotes.flatMap((q, qi) =>
                (q.boxes ?? []).map((b, i) => (
                  <div
                    key={`${qi}-${i}`}
                    className="box text-hl"
                    style={{ left: `${b[0] * 100}%`, top: `${b[1] * 100}%`, width: `${(b[2] - b[0]) * 100}%`, height: `${(b[3] - b[1]) * 100}%` }}
                  />
                )),
              )}
            </div>
          </figure>
        );
      })}
    </>
  );
}
