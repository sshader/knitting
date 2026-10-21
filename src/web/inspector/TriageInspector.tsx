import { useCallback, useEffect, useMemo, useState } from "react";
import type { BBox } from "../../extract/pageData";
import type { PageTriage } from "../../extract/triage";
import {
  detected,
  mismatches,
  type ExpectedForm,
  type TriageFixture,
  type TriagePageExpectation,
} from "../../extract/triageFixture";

/**
 * Dev tool for reviewing stage 0 triage: every page with detected regions
 * overlaid. Reviewing a page records the expected result as a fixture.
 *
 * Keys in the detail view: j/k next/previous page, a accept as detected, esc close.
 */

interface IndexEntry {
  slug: string;
  title?: string;
  pageCount: number;
  sentToLlm: number;
  charts: Record<string, number>;
}

const FORMS: ExpectedForm[] = ["vector", "font", "writtenColor", "raster"];
const pageImg = (slug: string, n: number) => `/data/raw/${slug}/pages/p${String(n).padStart(2, "0")}.png`;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function TriageInspector() {
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [slug, setSlug] = useState<string | null>(() => new URLSearchParams(location.search).get("p"));
  const [pages, setPages] = useState<PageTriage[]>([]);
  const [fixture, setFixture] = useState<TriageFixture>({});
  const [open, setOpen] = useState<number | null>(null);
  const [onlyInteresting, setOnlyInteresting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<IndexEntry[]>("/data/triage/index.json")
      .then((ix) => {
        setIndex(ix);
        setSlug((s) => s ?? ix[0]?.slug ?? null);
      })
      .catch((e) => setError(`${e}. Run: npx tsx scripts/triage.ts`));
  }, []);

  useEffect(() => {
    if (!slug) return;
    const params = new URLSearchParams(location.search);
    params.set("p", slug);
    history.replaceState(null, "", `?${params}`);
    setOpen(null);
    Promise.all([getJson<PageTriage[]>(`/data/triage/${slug}.json`), getJson<TriageFixture>(`/api/fixtures/triage/${slug}`)])
      .then(([p, f]) => {
        setPages(p);
        setFixture(f);
      })
      .catch((e) => setError(String(e)));
  }, [slug]);

  const save = useCallback(
    (page: number, e: TriagePageExpectation | null) => {
      if (!slug) return;
      setFixture((prev) => {
        const next = { ...prev };
        if (e) next[page] = e;
        else delete next[page];
        fetch(`/api/fixtures/triage/${slug}`, { method: "PUT", body: JSON.stringify(next) }).catch((err) => setError(String(err)));
        return next;
      });
    },
    [slug],
  );

  const visible = useMemo(
    () => pages.filter((p) => !onlyInteresting || p.charts.length > 0 || p.images.length > 0 || !p.sendToLlm),
    [pages, onlyInteresting],
  );
  const reviewed = pages.filter((p) => fixture[p.page]).length;
  const failing = pages.filter((p) => fixture[p.page] && mismatches(p, fixture[p.page]).length > 0).length;

  return (
    <div className="inspector">
      <aside>
        <h1>Triage</h1>
        <ul>
          {index.map((e) => (
            <li key={e.slug} className={e.slug === slug ? "active" : ""} onClick={() => setSlug(e.slug)}>
              <div className="name">{e.title ?? e.slug}</div>
              <div className="meta">
                {e.pageCount}p · {e.sentToLlm} to LLM
                {Object.entries(e.charts).map(([f, n]) => (
                  <span key={f} className={`chip ${f}`}>
                    {n} {f}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="legend">
          {FORMS.map((f) => (
            <span key={f} className={`chip ${f}`}>
              {f === "raster" ? "image" : f}
            </span>
          ))}
        </div>
      </aside>

      <main>
        {error && <div className="error">{error}</div>}
        <header>
          <span>
            Reviewed {reviewed}/{pages.length}
            {failing > 0 && <b className="bad"> · {failing} wrong</b>}
          </span>
          <label>
            <input type="checkbox" checked={onlyInteresting} onChange={(e) => setOnlyInteresting(e.target.checked)} /> Only pages
            with charts, images, or skipped
          </label>
        </header>
        <div className="grid">
          {visible.map((p) => (
            <PageCard key={p.page} slug={slug!} p={p} expect={fixture[p.page]} onOpen={() => setOpen(p.page)} />
          ))}
        </div>
      </main>

      {open !== null && slug && (
        <Detail
          slug={slug}
          p={pages.find((x) => x.page === open)!}
          expect={fixture[open]}
          onSave={(e) => save(open, e)}
          onMove={(d) => {
            const i = visible.findIndex((x) => x.page === open) + d;
            if (i >= 0 && i < visible.length) setOpen(visible[i].page);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Overlay({ p }: { p: PageTriage }) {
  const box = (b: BBox) => ({
    left: `${b[0] * 100}%`,
    top: `${b[1] * 100}%`,
    width: `${(b[2] - b[0]) * 100}%`,
    height: `${(b[3] - b[1]) * 100}%`,
  });
  return (
    <>
      {p.images.map((im, i) => (
        <div key={`i${i}`} className="box raster" style={box(im.bbox)} title={`image ${Math.round(im.coverage * 100)}%`} />
      ))}
      {p.charts.map((c, i) => (
        <div key={`c${i}`} className={`box ${c.form}`} style={box(c.bbox)} title={c.evidence} />
      ))}
    </>
  );
}

function status(p: PageTriage, e?: TriagePageExpectation) {
  if (!e) return { cls: "unreviewed", label: "" };
  const m = mismatches(p, e);
  return m.length ? { cls: "wrong", label: "✗" } : { cls: "ok", label: "✓" };
}

function PageCard({ slug, p, expect, onOpen }: { slug: string; p: PageTriage; expect?: TriagePageExpectation; onOpen: () => void }) {
  const s = status(p, expect);
  return (
    <figure className={`card ${s.cls}`} onClick={onOpen}>
      <div className="page">
        <img src={pageImg(slug, p.page)} loading="lazy" alt={`page ${p.page}`} />
        <Overlay p={p} />
      </div>
      <figcaption>
        <span>p{p.page}</span>
        <span className={p.sendToLlm ? "llm" : "skip"}>
          {p.sendToLlm ? "LLM" : p.llmCrops.length ? `${p.llmCrops.length} crop${p.llmCrops.length > 1 ? "s" : ""} to LLM` : "skip"}
        </span>
        <span className="status">{s.label}</span>
      </figcaption>
    </figure>
  );
}

function Detail({
  slug,
  p,
  expect,
  onSave,
  onMove,
  onClose,
}: {
  slug: string;
  p: PageTriage;
  expect?: TriagePageExpectation;
  onSave: (e: TriagePageExpectation | null) => void;
  onMove: (d: number) => void;
  onClose: () => void;
}) {
  const draft = expect ?? detected(p);
  const set = (patch: Partial<TriagePageExpectation>) => onSave({ ...draft, ...patch });
  const setCount = (f: ExpectedForm, n: number) => {
    const charts = { ...draft.charts, [f]: Math.max(0, n) };
    if (!charts[f]) delete charts[f];
    set({ charts });
  };
  const m = expect ? mismatches(p, expect) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "j" || e.key === "ArrowRight") onMove(1);
      else if (e.key === "k" || e.key === "ArrowLeft") onMove(-1);
      else if (e.key === "a") {
        onSave(expect ?? detected(p));
        onMove(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p, expect, onSave, onMove, onClose]);

  return (
    <div className="detail" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="page big">
          <img src={pageImg(slug, p.page)} alt={`page ${p.page}`} />
          <Overlay p={p} />
        </div>
        <section>
          <h2>
            Page {p.page} <small>{p.reason}</small>
          </h2>
          {p.llmCrops.length > 0 && <p className="meta">Images on this page go to the LLM as {p.llmCrops.length} crop(s).</p>}
          <p className="meta">
            {p.textChars} chars · {p.proseChars} prose
            {p.writtenRows.count > 0 && ` · ${p.writtenRows.count} row lines (${p.writtenRows.first}–${p.writtenRows.last})`}
          </p>
          <h3>Detected</h3>
          <ul className="regions">
            {p.charts.map((c, i) => (
              <li key={i}>
                <span className={`chip ${c.form}`}>{c.form}</span> {c.evidence}
              </li>
            ))}
            {p.images.map((im, i) => (
              <li key={`i${i}`}>
                <span className="chip raster">image</span> {Math.round(im.coverage * 100)}% of page
              </li>
            ))}
            {p.charts.length + p.images.length === 0 && <li className="muted">nothing</li>}
          </ul>

          <h3>
            Expected {expect ? (m.length ? <b className="bad">✗ wrong</b> : <b className="good">✓ matches</b>) : <i>(unreviewed)</i>}
          </h3>
          <table className="expect">
            <tbody>
              {FORMS.map((f) => (
                <tr key={f}>
                  <td>
                    <span className={`chip ${f}`}>{f === "raster" ? "image chart" : f}</span>
                  </td>
                  <td>
                    <button onClick={() => setCount(f, (draft.charts[f] ?? 0) - 1)}>−</button>
                    <span className="count">{draft.charts[f] ?? 0}</span>
                    <button onClick={() => setCount(f, (draft.charts[f] ?? 0) + 1)}>+</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td>send to LLM</td>
                <td>
                  <input type="checkbox" checked={draft.sendToLlm} onChange={(e) => set({ sendToLlm: e.target.checked })} />
                </td>
              </tr>
            </tbody>
          </table>
          {m.length > 0 && (
            <ul className="mismatches">
              {m.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <textarea
            placeholder="Note (what's on this page, what triage got wrong)"
            value={draft.note ?? ""}
            onChange={(e) => set({ note: e.target.value || undefined })}
          />
          <div className="actions">
            <button onClick={() => onMove(-1)}>← k</button>
            <button className="primary" onClick={() => (onSave(draft), onMove(1))}>
              {expect ? "Save & next" : "Accept & next"} (a)
            </button>
            {expect && <button onClick={() => onSave(null)}>Clear review</button>}
            <button onClick={() => onMove(1)}>j →</button>
          </div>
        </section>
      </div>
    </div>
  );
}
