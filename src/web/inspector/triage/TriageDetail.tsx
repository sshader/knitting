import { useEffect } from "react";
import { detected, mismatches, type ExpectedForm, type TriagePageExpectation } from "../../../extract/triageFixture";
import type { PageRow } from "../shared/types";
import { FORMS } from "./forms";
import { TriageOverlay } from "./TriageOverlay";

/**
 * One page, large, with what triage detected and the review form. Keys:
 * j/k next/previous page, a accept as detected, esc close.
 */
export function TriageDetail({
  p,
  onSave,
  onMove,
  onClose,
}: {
  p: PageRow;
  onSave: (review: TriagePageExpectation | null) => void;
  onMove: (delta: number) => void;
  onClose: () => void;
}) {
  const t = p.triage;
  const review = p.triageReview;
  const draft = review ?? detected(t);
  const set = (patch: Partial<TriagePageExpectation>) => onSave({ ...draft, ...patch });
  const setCount = (f: ExpectedForm, n: number) => {
    const charts = { ...draft.charts, [f]: Math.max(0, n) };
    if (!charts[f]) delete charts[f];
    set({ charts });
  };
  const wrong = review ? mismatches(t, review) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "j" || e.key === "ArrowRight") onMove(1);
      else if (e.key === "k" || e.key === "ArrowLeft") onMove(-1);
      else if (e.key === "a") {
        onSave(draft);
        onMove(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, onSave, onMove, onClose]);

  return (
    <div className="detail" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="page big">
          <img src={p.pngUrl} alt={`page ${p.page}`} />
          <TriageOverlay triage={t} />
        </div>
        <section>
          <h2>
            Page {p.page} <small>{t.reason}</small>
          </h2>
          <p className="meta">
            {p.doc} p{p.docPage}
          </p>
          {t.llmCrops.length > 0 && <p className="meta">Images on this page go to the LLM as {t.llmCrops.length} crop(s).</p>}
          <p className="meta">
            {t.textChars} chars · {t.proseChars} prose
            {t.writtenRows.count > 0 && ` · ${t.writtenRows.count} row lines (${t.writtenRows.first}–${t.writtenRows.last})`}
          </p>
          <h3>Detected</h3>
          <ul className="regions">
            {t.charts.map((c, i) => (
              <li key={i}>
                <span className={`chip ${c.form}`}>{c.form}</span> {c.evidence}
              </li>
            ))}
            {t.images.map((im, i) => (
              <li key={`i${i}`}>
                <span className="chip raster">image</span> {Math.round(im.coverage * 100)}% of page
              </li>
            ))}
            {t.charts.length + t.images.length === 0 && <li className="muted">nothing</li>}
          </ul>

          <h3>Expected {review ? wrong.length ? <b className="bad">✗ wrong</b> : <b className="good">✓ matches</b> : <i>(unreviewed)</i>}</h3>
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
          {wrong.length > 0 && (
            <ul className="mismatches">
              {wrong.map((x) => (
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
              {review ? "Save & next" : "Accept & next"} (a)
            </button>
            {review && <button onClick={() => onSave(null)}>Clear review</button>}
            <button onClick={() => onMove(1)}>j →</button>
          </div>
        </section>
      </div>
    </div>
  );
}
